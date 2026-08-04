package com.hotelsplit.repository;

import com.hotelsplit.entity.BillItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface BillItemRepository extends JpaRepository<BillItem, Long> {
    List<BillItem> findBySessionId(Long sessionId);
    List<BillItem> findBySessionRoomCode(String roomCode);

    @Query("SELECT COALESCE(SUM(b.amount), 0) FROM BillItem b WHERE b.session.id = :sessionId")
    BigDecimal sumAmountBySessionId(@Param("sessionId") Long sessionId);
}
