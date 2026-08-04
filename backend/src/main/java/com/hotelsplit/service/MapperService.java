package com.hotelsplit.service;

import com.hotelsplit.dto.BillDTOs;
import com.hotelsplit.dto.MemberDTOs;
import com.hotelsplit.dto.SessionDTOs;
import com.hotelsplit.entity.BillItem;
import com.hotelsplit.entity.ItemAssignment;
import com.hotelsplit.entity.Session;
import com.hotelsplit.entity.SessionMember;
import com.hotelsplit.repository.BillItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MapperService {

    private final BillItemRepository billItemRepository;
    private final QrService qrService;

    public SessionDTOs.SessionResponse toSessionResponse(Session session, boolean includeQr) {
        SessionDTOs.SessionResponse response = new SessionDTOs.SessionResponse();
        response.setId(session.getId());
        response.setRoomCode(session.getRoomCode());
        response.setHotelName(session.getHotelName());
        response.setTableNumber(session.getTableNumber());
        response.setSplitType(session.getSplitType());
        response.setCurrency(session.getCurrency());
        response.setTaxPercent(session.getTaxPercent());
        response.setTipPercent(session.getTipPercent());
        response.setStatus(session.getStatus());
        response.setDurationMinutes(session.getDurationMinutes());
        response.setStartedAt(session.getStartedAt());
        response.setClosedAt(session.getClosedAt());
        response.setCreatedAt(session.getCreatedAt());
        response.setHostName(session.getHost().getDisplayName());
        response.setHostId(session.getHost().getId());
        response.setHostUpiId(session.getHostUpiId());
        response.setRazorpayKeyId(session.getRazorpayKeyId());
        response.setPdfUrl(session.getPdfUrl());
        response.setIncludeHost(session.getIncludeHost());
        response.setTotalAmount(billItemRepository.sumAmountBySessionId(session.getId()));

        if (includeQr) {
            response.setQrCodeBase64(qrService.generateQrCodeBase64(session.getRoomCode()));
        }

        if (session.getMembers() != null && !session.getMembers().isEmpty()) {
            response.setMembers(session.getMembers().stream()
                .map(this::toMemberResponse)
                .toList());
        }

        if (session.getBillItems() != null && !session.getBillItems().isEmpty()) {
            response.setBillItems(session.getBillItems().stream()
                .map(this::toBillItemResponse)
                .toList());
        }

        return response;
    }

    public MemberDTOs.MemberResponse toMemberResponse(SessionMember member) {
        MemberDTOs.MemberResponse response = new MemberDTOs.MemberResponse();
        response.setId(member.getId());
        response.setDisplayName(member.getDisplayName());
        response.setIsHost(member.getIsHost());
        response.setPaymentStatus(member.getPaymentStatus());
        response.setShareAmount(member.getShareAmount());
        response.setJoinedAt(member.getJoinedAt());
        return response;
    }

    public BillDTOs.BillItemResponse toBillItemResponse(BillItem item) {
        BillDTOs.BillItemResponse response = new BillDTOs.BillItemResponse();
        response.setId(item.getId());
        response.setItemName(item.getItemName());
        response.setAmount(item.getAmount());
        response.setDescription(item.getDescription());
        response.setCreatedAt(item.getCreatedAt());

        if (item.getAddedBy() != null) {
            response.setAddedByName(item.getAddedBy().getDisplayName());
        }

        if (item.getAssignments() != null && !item.getAssignments().isEmpty()) {
            response.setAssignedMemberNames(item.getAssignments().stream()
                .map(a -> a.getAssignedMember().getDisplayName())
                .toList());
            response.setAssignedMemberIds(item.getAssignments().stream()
                .map(a -> a.getAssignedMember().getId())
                .toList());
        }

        return response;
    }
}
