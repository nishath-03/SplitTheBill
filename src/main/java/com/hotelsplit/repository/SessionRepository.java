package com.hotelsplit.repository;

import com.hotelsplit.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface SessionRepository extends JpaRepository<Session, Long> {
    Optional<Session> findByRoomCode(String roomCode);
    boolean existsByRoomCode(String roomCode);
    List<Session> findByHostId(Long hostId);

    @Query("SELECT s FROM Session s WHERE s.status = 'ACTIVE' AND s.startedAt < :expireBefore")
    List<Session> findExpiredActiveSessions(@Param("expireBefore") LocalDateTime expireBefore);

    @Query("SELECT s FROM Session s WHERE s.status = 'GRACE_PERIOD' AND s.closedAt < :expireBefore")
    List<Session> findExpiredGraceSessions(@Param("expireBefore") LocalDateTime expireBefore);
}
