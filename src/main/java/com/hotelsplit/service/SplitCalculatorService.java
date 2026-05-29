package com.hotelsplit.service;

import com.hotelsplit.dto.BillDTOs;
import com.hotelsplit.entity.*;
import com.hotelsplit.repository.BillItemRepository;
import com.hotelsplit.repository.ItemAssignmentRepository;
import com.hotelsplit.repository.SessionMemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SplitCalculatorService {

    private final BillItemRepository billItemRepository;
    private final SessionMemberRepository memberRepository;
    private final ItemAssignmentRepository assignmentRepository;

    public Map<Long, BigDecimal> calculate(Session session) {
        return switch (session.getSplitType()) {
            case EQUAL -> calculateEqualSplit(session);
            case ITEMWISE -> calculateItemwiseSplit(session);
            case PERCENTAGE -> calculateEqualSplit(session); // fallback to equal for now
        };
    }

    private Map<Long, BigDecimal> calculateEqualSplit(Session session) {
        List<SessionMember> members = memberRepository.findBySessionId(session.getId());
        BigDecimal subtotal = billItemRepository.sumAmountBySessionId(session.getId());
        BigDecimal total = applyTaxAndTip(subtotal, session.getTaxPercent(), session.getTipPercent());

        boolean includeHost = session.getIncludeHost() != null && session.getIncludeHost();

        int denominator;
        if (includeHost) {
            denominator = members.size();
        } else {
            long nonHostCount = members.stream().filter(m -> !m.getIsHost()).count();
            denominator = (int) (nonHostCount > 0 ? nonHostCount : members.size());
        }

        BigDecimal share = total.divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);

        Map<Long, BigDecimal> result = new HashMap<>();
        for (SessionMember member : members) {
            if (includeHost || !member.getIsHost()) {
                result.put(member.getId(), share);
            }
        }
        return result;
    }

    private Map<Long, BigDecimal> calculateItemwiseSplit(Session session) {
        List<SessionMember> members = memberRepository.findBySessionId(session.getId());
        List<BillItem> items = billItemRepository.findBySessionId(session.getId());
        Map<Long, BigDecimal> result = new HashMap<>();

        boolean includeHost = session.getIncludeHost() != null && session.getIncludeHost();

        // Initialize all eligible members with 0
        for (SessionMember member : members) {
            if (includeHost || !member.getIsHost()) {
                result.put(member.getId(), BigDecimal.ZERO);
            }
        }

        for (BillItem item : items) {
            List<ItemAssignment> assignments = assignmentRepository.findByBillItemId(item.getId());

            if (assignments.isEmpty()) {
                // Unassigned items split equally among eligible members
                List<SessionMember> targetMembers = includeHost ? members : members.stream().filter(m -> !m.getIsHost()).toList();
                if (!targetMembers.isEmpty()) {
                    BigDecimal share = item.getAmount().divide(
                        BigDecimal.valueOf(targetMembers.size()), 2, RoundingMode.HALF_UP);
                    for (SessionMember member : targetMembers) {
                        result.merge(member.getId(), share, BigDecimal::add);
                    }
                }
            } else {
                BigDecimal sharePerPerson = item.getAmount().divide(
                    BigDecimal.valueOf(assignments.size()), 2, RoundingMode.HALF_UP);
                for (ItemAssignment assignment : assignments) {
                    Long memberId = assignment.getAssignedMember().getId();
                    if (includeHost || !assignment.getAssignedMember().getIsHost()) {
                        result.merge(memberId, sharePerPerson, BigDecimal::add);
                    }
                }
            }
        }

        // Apply tax and tip proportionally
        BigDecimal subtotal = billItemRepository.sumAmountBySessionId(session.getId());
        if (subtotal.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal total = applyTaxAndTip(subtotal, session.getTaxPercent(), session.getTipPercent());
            BigDecimal multiplier = total.divide(subtotal, 6, RoundingMode.HALF_UP);
            result.replaceAll((id, amount) -> amount.multiply(multiplier).setScale(2, RoundingMode.HALF_UP));
        }

        return result;
    }

    private BigDecimal applyTaxAndTip(BigDecimal subtotal, BigDecimal taxPercent, BigDecimal tipPercent) {
        BigDecimal taxAmount = subtotal.multiply(taxPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal withTax = subtotal.add(taxAmount);
        BigDecimal tipAmount = withTax.multiply(tipPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        return withTax.add(tipAmount);
    }

    public BillDTOs.BillSummaryResponse buildSummary(Session session, Map<Long, BigDecimal> shares) {
        BigDecimal subtotal = billItemRepository.sumAmountBySessionId(session.getId());
        BigDecimal taxAmount = subtotal.multiply(session.getTaxPercent())
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal withTax = subtotal.add(taxAmount);
        BigDecimal tipAmount = withTax.multiply(session.getTipPercent())
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal total = withTax.add(tipAmount);

        List<SessionMember> members = memberRepository.findBySessionId(session.getId());
        List<BillDTOs.MemberShareResponse> memberShares = new ArrayList<>();
        boolean includeHost = session.getIncludeHost() != null && session.getIncludeHost();
        for (SessionMember member : members) {
            if (includeHost || !member.getIsHost()) {
                BillDTOs.MemberShareResponse msr = new BillDTOs.MemberShareResponse();
                msr.setMemberId(member.getId());
                msr.setDisplayName(member.getDisplayName());
                msr.setShareAmount(shares.getOrDefault(member.getId(), BigDecimal.ZERO));
                msr.setPaymentStatus(member.getPaymentStatus().name());
                memberShares.add(msr);
            }
        }

        BillDTOs.BillSummaryResponse summary = new BillDTOs.BillSummaryResponse();
        summary.setSubtotal(subtotal);
        summary.setTaxAmount(taxAmount);
        summary.setTipAmount(tipAmount);
        summary.setTotalAmount(total);
        summary.setTaxPercent(session.getTaxPercent());
        summary.setTipPercent(session.getTipPercent());
        summary.setMemberShares(memberShares);
        return summary;
    }
}
