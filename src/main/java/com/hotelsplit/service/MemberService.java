package com.hotelsplit.service;

import com.hotelsplit.dto.MemberDTOs;
import com.hotelsplit.entity.*;
import com.hotelsplit.exception.BadRequestException;
import com.hotelsplit.exception.ConflictException;
import com.hotelsplit.exception.NotFoundException;
import com.hotelsplit.exception.UnauthorizedException;
import com.hotelsplit.repository.SessionMemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MemberService {

    private final SessionMemberRepository memberRepository;
    private final SessionService sessionService;
    private final MapperService mapperService;

    @Transactional
    public MemberDTOs.JoinResponse joinSession(String roomCode, MemberDTOs.JoinRequest request) {
        Session session = sessionService.getSessionByCode(roomCode);

        if (session.getStatus() == Session.SessionStatus.SETTLED ||
            session.getStatus() == Session.SessionStatus.COLLECTING) {
            throw new BadRequestException("Session is no longer accepting new members");
        }

        // Check for duplicate display name in session
        boolean nameExists = memberRepository.findBySessionId(session.getId())
            .stream()
            .anyMatch(m -> m.getDisplayName().equalsIgnoreCase(request.getDisplayName()));
        if (nameExists) {
            throw new ConflictException("Display name '" + request.getDisplayName() + "' is already taken in this session");
        }

        // Generate a simple guest token for identification
        String guestToken = UUID.randomUUID().toString();

        SessionMember member = SessionMember.builder()
            .session(session)
            .displayName(request.getDisplayName())
            .isHost(false)
            .paymentStatus(SessionMember.PaymentStatus.PENDING)
            .build();

        member = memberRepository.save(member);

        sessionService.broadcastSessionUpdate(roomCode, "MEMBER_JOINED",
            Map.of("memberId", member.getId(), "displayName", member.getDisplayName()));

        log.info("Member '{}' joined session {}", request.getDisplayName(), roomCode);

        MemberDTOs.JoinResponse response = new MemberDTOs.JoinResponse();
        response.setMemberId(member.getId());
        response.setDisplayName(member.getDisplayName());
        response.setRoomCode(roomCode);
        response.setSessionStatus(session.getStatus().name());
        response.setHotelName(session.getHotelName());
        response.setGuestToken(guestToken);
        return response;
    }

    public List<MemberDTOs.MemberResponse> getMembers(String roomCode) {
        Session session = sessionService.getSessionByCode(roomCode);
        return memberRepository.findBySessionId(session.getId())
            .stream()
            .map(mapperService::toMemberResponse)
            .toList();
    }

    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public void markAsPaid(Long memberId) {
        SessionMember member = memberRepository.findByIdWithLock(memberId)
            .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));

        if (member.getPaymentStatus() != SessionMember.PaymentStatus.PENDING &&
            member.getPaymentStatus() != SessionMember.PaymentStatus.REJECTED) {
            throw new BadRequestException("Payment already marked");
        }

        member.setPaymentStatus(SessionMember.PaymentStatus.MARKED);
        memberRepository.save(member);

        sessionService.broadcastSessionUpdate(member.getSession().getRoomCode(), "PAYMENT_MARKED",
            Map.of("memberId", memberId, "displayName", member.getDisplayName()));
    }

    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public void confirmPayment(Long memberId, Long hostId) {
        SessionMember member = memberRepository.findByIdWithLock(memberId)
            .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));

        sessionService.validateHost(member.getSession(), hostId);

        if (member.getPaymentStatus() != SessionMember.PaymentStatus.MARKED) {
            throw new BadRequestException("Member has not marked payment yet");
        }

        member.setPaymentStatus(SessionMember.PaymentStatus.CONFIRMED);
        memberRepository.save(member);

        sessionService.broadcastSessionUpdate(member.getSession().getRoomCode(), "PAYMENT_CONFIRMED",
            Map.of("memberId", memberId, "displayName", member.getDisplayName()));

        // Auto-check if all are confirmed
        checkAutoSettle(member.getSession());
    }

    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public void confirmRazorpayPayment(Long memberId, String paymentId) {
        SessionMember member = memberRepository.findByIdWithLock(memberId)
            .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));

        member.setPaymentStatus(SessionMember.PaymentStatus.CONFIRMED);
        memberRepository.save(member);

        sessionService.broadcastSessionUpdate(member.getSession().getRoomCode(), "PAYMENT_CONFIRMED",
            Map.of("memberId", memberId, "displayName", member.getDisplayName(), "paymentMethod", "RAZORPAY", "paymentId", paymentId));

        // Auto-check if all are confirmed
        checkAutoSettle(member.getSession());
    }

    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public void rejectPayment(Long memberId, Long hostId) {
        SessionMember member = memberRepository.findByIdWithLock(memberId)
            .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));

        sessionService.validateHost(member.getSession(), hostId);

        if (member.getPaymentStatus() != SessionMember.PaymentStatus.MARKED) {
            throw new BadRequestException("Cannot reject — member has not marked payment");
        }

        member.setPaymentStatus(SessionMember.PaymentStatus.REJECTED);
        memberRepository.save(member);

        sessionService.broadcastSessionUpdate(member.getSession().getRoomCode(), "PAYMENT_REJECTED",
            Map.of("memberId", memberId, "displayName", member.getDisplayName()));
    }

    private void checkAutoSettle(Session session) {
        long unconfirmed = memberRepository.countUnconfirmedMembers(session.getId());
        long nonHost = memberRepository.countNonHostMembers(session.getId());
        if (unconfirmed == 0 && nonHost > 0) {
            log.info("All payments confirmed for session {}, ready to settle", session.getRoomCode());
            sessionService.broadcastSessionUpdate(session.getRoomCode(), "ALL_CONFIRMED", Map.of());
        }
    }
}
