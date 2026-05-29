package com.hotelsplit.repository;

import com.hotelsplit.entity.SpinnerResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SpinnerResultRepository extends JpaRepository<SpinnerResult, Long> {
    List<SpinnerResult> findBySessionId(Long sessionId);
    List<SpinnerResult> findBySessionRoomCode(String roomCode);
}
