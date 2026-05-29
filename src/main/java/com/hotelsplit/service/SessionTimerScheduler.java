package com.hotelsplit.service;

import com.hotelsplit.entity.Session;
import com.hotelsplit.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SessionTimerScheduler {

    private final SessionRepository sessionRepository;
    private final SessionService sessionService;

    // Check every 30 seconds
    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void checkExpiredSessions() {
        // Auto-close ACTIVE sessions that have exceeded their duration
        List<Session> expiredActive = sessionRepository.findExpiredActiveSessions(
            LocalDateTime.now().minusMinutes(0) // sessions where startedAt + durationMinutes < now
        );

        for (Session session : expiredActive) {
            if (session.getStartedAt() != null) {
                LocalDateTime expireAt = session.getStartedAt().plusMinutes(session.getDurationMinutes());
                if (LocalDateTime.now().isAfter(expireAt)) {
                    log.info("Auto-closing expired session: {}", session.getRoomCode());
                    session.setStatus(Session.SessionStatus.GRACE_PERIOD);
                    session.setClosedAt(LocalDateTime.now());
                    sessionRepository.save(session);
                    sessionService.broadcastSessionUpdate(session.getRoomCode(), "SESSION_AUTO_CLOSED",
                        Map.of("status", "GRACE_PERIOD", "message", "Session time expired"));
                }
            }
        }

        // Auto-transition GRACE_PERIOD sessions after 5 minutes
        List<Session> expiredGrace = sessionRepository.findExpiredGraceSessions(
            LocalDateTime.now().minusMinutes(5)
        );

        for (Session session : expiredGrace) {
            log.info("Grace period expired for session: {}", session.getRoomCode());
            sessionService.broadcastSessionUpdate(session.getRoomCode(), "GRACE_PERIOD_ENDED",
                Map.of("message", "Grace period ended — please calculate and distribute shares"));
        }
    }
}
