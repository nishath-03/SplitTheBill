package com.hotelsplit.service;

import com.hotelsplit.entity.*;
import com.hotelsplit.exception.BadRequestException;
import com.hotelsplit.exception.NotFoundException;
import com.hotelsplit.repository.SessionMemberRepository;
import com.hotelsplit.repository.SpinnerResultRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SpinnerService {

    private final SessionMemberRepository memberRepository;
    private final SpinnerResultRepository spinnerResultRepository;
    private final SessionService sessionService;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Transactional
    public SpinResult spin(String roomCode, Long hostId, String reason) {
        Session session = sessionService.getSessionByCode(roomCode);
        sessionService.validateHost(session, hostId);

        if (session.getStatus() != Session.SessionStatus.ACTIVE &&
            session.getStatus() != Session.SessionStatus.GRACE_PERIOD) {
            throw new BadRequestException("Can only spin when session is ACTIVE");
        }

        List<SessionMember> members = memberRepository.findBySessionId(session.getId());
        if (members.size() < 2) {
            throw new BadRequestException("Need at least 2 members to spin");
        }

        // SecureRandom pick
        int winnerIndex = SECURE_RANDOM.nextInt(members.size());
        SessionMember winner = members.get(winnerIndex);

        SpinnerResult result = SpinnerResult.builder()
            .session(session)
            .winner(winner)
            .reason(reason)
            .build();
        spinnerResultRepository.save(result);

        sessionService.broadcastSessionUpdate(roomCode, "SPINNER_RESULT",
            Map.of("winnerIndex", winnerIndex, "winnerName", winner.getDisplayName(),
                   "reason", reason != null ? reason : "Spin!",
                   "members", members.stream().map(SessionMember::getDisplayName).toList()));

        log.info("Spinner landed on '{}' in session {}", winner.getDisplayName(), roomCode);

        return new SpinResult(winner.getId(), winner.getDisplayName(), winnerIndex,
            members.stream().map(SessionMember::getDisplayName).toList());
    }

    public List<SpinnerResult> getSpinHistory(String roomCode) {
        Session session = sessionService.getSessionByCode(roomCode);
        return spinnerResultRepository.findBySessionId(session.getId());
    }

    @Data
    public static class SpinResult {
        private final Long winnerId;
        private final String winnerName;
        private final int winnerIndex;
        private final List<String> members;
    }
}
