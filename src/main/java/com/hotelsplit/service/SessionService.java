package com.hotelsplit.service;

import com.hotelsplit.dto.BillDTOs;
import com.hotelsplit.dto.SessionDTOs;
import com.hotelsplit.entity.*;
import com.hotelsplit.exception.BadRequestException;
import com.hotelsplit.exception.NotFoundException;
import com.hotelsplit.exception.UnauthorizedException;
import com.hotelsplit.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    private final SessionRepository sessionRepository;
    private final SessionMemberRepository memberRepository;
    private final BillItemRepository billItemRepository;
    private final UserRepository userRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    private final QrService qrService;
    private final SplitCalculatorService splitCalculatorService;
    private final SimpMessagingTemplate messagingTemplate;
    private final MapperService mapperService;

    @Transactional
    public SessionDTOs.SessionResponse createSession(SessionDTOs.CreateSessionRequest request, Long hostId) {
        User host = userRepository.findById(hostId)
            .orElseThrow(() -> new NotFoundException("User not found"));

        String roomCode = generateUniqueRoomCode();

        Session session = Session.builder()
            .roomCode(roomCode)
            .hotelName(request.getHotelName())
            .tableNumber(request.getTableNumber())
            .splitType(request.getSplitType())
            .currency(request.getCurrency() != null ? request.getCurrency() : "INR")
            .taxPercent(request.getTaxPercent() != null ? request.getTaxPercent() : BigDecimal.ZERO)
            .tipPercent(request.getTipPercent() != null ? request.getTipPercent() : BigDecimal.ZERO)
            .durationMinutes(request.getDurationMinutes() != null ? request.getDurationMinutes() : 120)
            .hostUpiId(request.getHostUpiId())
            .includeHost(request.getIncludeHost() != null ? request.getIncludeHost() : true)
            .status(Session.SessionStatus.WAITING)
            .host(host)
            .build();

        session = sessionRepository.save(session);

        // Add host as first member
        SessionMember hostMember = SessionMember.builder()
            .session(session)
            .displayName(host.getDisplayName())
            .user(host)
            .isHost(true)
            .paymentStatus(SessionMember.PaymentStatus.CONFIRMED)
            .build();
        memberRepository.save(hostMember);

        // Cache room code in Redis for 24h (optional fallback if Redis is down)
        try {
            redisTemplate.opsForValue().set("session:" + roomCode, session.getId().toString(), 24, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("Failed to cache room code in Redis (app will continue normally): {}", e.getMessage());
        }

        log.info("Session created: {} by host: {}", roomCode, host.getEmail());
        return mapperService.toSessionResponse(session, true);
    }

    public SessionDTOs.SessionResponse getSession(String roomCode, boolean includeQr) {
        Session session = getSessionByCode(roomCode);
        return mapperService.toSessionResponse(session, includeQr);
    }

    public List<SessionDTOs.SessionResponse> getHostSessions(Long hostId) {
        List<Session> sessions = sessionRepository.findByHostId(hostId);
        return sessions.stream()
            .map(s -> mapperService.toSessionResponse(s, false))
            .toList();
    }

    @Transactional
    public SessionDTOs.SessionResponse startSession(String roomCode, Long hostId) {
        Session session = getSessionByCode(roomCode);
        validateHost(session, hostId);

        if (session.getStatus() != Session.SessionStatus.WAITING) {
            throw new BadRequestException("Session can only be started from WAITING state");
        }

        if (memberRepository.findBySessionId(session.getId()).size() < 2) {
            throw new BadRequestException("At least 2 members are needed to start a session");
        }

        session.setStatus(Session.SessionStatus.ACTIVE);
        session.setStartedAt(LocalDateTime.now());
        sessionRepository.save(session);

        broadcastSessionUpdate(roomCode, "SESSION_STARTED", Map.of("status", "ACTIVE"));
        return mapperService.toSessionResponse(session, false);
    }

    @Transactional
    public SessionDTOs.SessionResponse closeSession(String roomCode, Long hostId) {
        Session session = getSessionByCode(roomCode);
        validateHost(session, hostId);

        if (session.getStatus() != Session.SessionStatus.ACTIVE) {
            throw new BadRequestException("Session must be ACTIVE to close");
        }

        session.setStatus(Session.SessionStatus.GRACE_PERIOD);
        session.setClosedAt(LocalDateTime.now());
        sessionRepository.save(session);

        broadcastSessionUpdate(roomCode, "GRACE_PERIOD_STARTED", Map.of("status", "GRACE_PERIOD"));
        return mapperService.toSessionResponse(session, false);
    }

    @Transactional
    public BillDTOs.BillSummaryResponse calculateAndDistribute(String roomCode, Long hostId) {
        Session session = getSessionByCode(roomCode);
        validateHost(session, hostId);

        if (session.getStatus() != Session.SessionStatus.GRACE_PERIOD &&
            session.getStatus() != Session.SessionStatus.ACTIVE) {
            throw new BadRequestException("Cannot calculate split in current session state");
        }

        Map<Long, BigDecimal> shares = splitCalculatorService.calculate(session);

        // Save share amounts to members
        List<SessionMember> members = memberRepository.findBySessionId(session.getId());
        for (SessionMember member : members) {
            if (shares.containsKey(member.getId())) {
                member.setShareAmount(shares.get(member.getId()));
                memberRepository.save(member);
            }
        }

        session.setStatus(Session.SessionStatus.COLLECTING);
        sessionRepository.save(session);

        broadcastSessionUpdate(roomCode, "COLLECTION_STARTED", Map.of("status", "COLLECTING", "shares", shares));

        return splitCalculatorService.buildSummary(session, shares);
    }

    @Transactional
    public SessionDTOs.SessionResponse updateTaxTip(String roomCode, Long hostId,
                                                     SessionDTOs.UpdateTaxTipRequest request) {
        Session session = getSessionByCode(roomCode);
        validateHost(session, hostId);

        if (request.getTaxPercent() != null) session.setTaxPercent(request.getTaxPercent());
        if (request.getTipPercent() != null) session.setTipPercent(request.getTipPercent());
        if (request.getHostUpiId() != null) session.setHostUpiId(request.getHostUpiId());
        if (request.getSplitType() != null) session.setSplitType(request.getSplitType());
        if (request.getIncludeHost() != null) session.setIncludeHost(request.getIncludeHost());
        if (request.getRazorpayKeyId() != null) {
            if (request.getRazorpayKeyId().trim().isEmpty() || request.getRazorpayKeyId().equalsIgnoreCase("null")) {
                session.setRazorpayKeyId(null);
            } else {
                session.setRazorpayKeyId(request.getRazorpayKeyId().trim());
            }
        }
        sessionRepository.save(session);

        broadcastSessionUpdate(roomCode, "SESSION_SETTINGS_UPDATED", mapperService.toSessionResponse(session, false));

        return mapperService.toSessionResponse(session, false);
    }

    @Transactional
    public void settleSession(String roomCode, Long hostId) {
        Session session = getSessionByCode(roomCode);
        validateHost(session, hostId);

        if (session.getStatus() != Session.SessionStatus.COLLECTING) {
            throw new BadRequestException("Session must be in COLLECTING state to settle");
        }

        long unconfirmed = memberRepository.countUnconfirmedMembers(session.getId());
        if (unconfirmed > 0) {
            throw new BadRequestException(unconfirmed + " member(s) have not confirmed payment yet");
        }

        session.setStatus(Session.SessionStatus.SETTLED);
        sessionRepository.save(session);

        broadcastSessionUpdate(roomCode, "SESSION_SETTLED", Map.of("status", "SETTLED"));
    }

    // Internal helpers
    public Session getSessionByCode(String roomCode) {
        return sessionRepository.findByRoomCode(roomCode.toUpperCase())
            .orElseThrow(() -> new NotFoundException("Session not found: " + roomCode));
    }

    public void validateHost(Session session, Long hostId) {
        if (!session.getHost().getId().equals(hostId)) {
            throw new UnauthorizedException("Only the host can perform this action");
        }
    }

    private String generateUniqueRoomCode() {
        String code;
        int attempts = 0;
        do {
            code = RandomStringUtils.randomAlphanumeric(6).toUpperCase();
            attempts++;
            if (attempts > 20) throw new RuntimeException("Could not generate unique room code");
        } while (sessionRepository.existsByRoomCode(code));
        return code;
    }

    public void broadcastSessionUpdate(String roomCode, String eventType, Object data) {
        messagingTemplate.convertAndSend("/topic/session/" + roomCode,
            Map.of("event", eventType, "data", data));
    }
}
