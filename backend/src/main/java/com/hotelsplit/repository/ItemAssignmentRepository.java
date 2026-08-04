package com.hotelsplit.repository;

import com.hotelsplit.entity.ItemAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface ItemAssignmentRepository extends JpaRepository<ItemAssignment, Long> {
    List<ItemAssignment> findByAssignedMemberId(Long memberId);
    List<ItemAssignment> findByBillItemId(Long billItemId);

    @Query("SELECT COALESCE(SUM(ia.billItem.amount / SIZE(ia.billItem.assignments)), 0) " +
           "FROM ItemAssignment ia WHERE ia.assignedMember.id = :memberId " +
           "AND ia.billItem.session.id = :sessionId")
    BigDecimal sumShareForMember(@Param("memberId") Long memberId, @Param("sessionId") Long sessionId);
}
