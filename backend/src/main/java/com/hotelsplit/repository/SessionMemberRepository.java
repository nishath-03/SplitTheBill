package com.hotelsplit.repository;

import com.hotelsplit.entity.SessionMember;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SessionMemberRepository extends JpaRepository<SessionMember, Long> {
    List<SessionMember> findBySessionId(Long sessionId);
    List<SessionMember> findBySessionRoomCode(String roomCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM SessionMember m WHERE m.id = :id")
    Optional<SessionMember> findByIdWithLock(@Param("id") Long id);

    @Query("SELECT COUNT(m) FROM SessionMember m WHERE m.session.id = :sessionId AND m.paymentStatus != 'CONFIRMED'")
    long countUnconfirmedMembers(@Param("sessionId") Long sessionId);

    @Query("SELECT COUNT(m) FROM SessionMember m WHERE m.session.id = :sessionId AND m.isHost = false")
    long countNonHostMembers(@Param("sessionId") Long sessionId);
}
