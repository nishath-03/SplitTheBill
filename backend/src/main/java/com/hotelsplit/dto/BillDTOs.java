package com.hotelsplit.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class BillDTOs {

    @Data
    public static class AddBillItemRequest {
        @NotBlank(message = "Item name is required")
        @Size(max = 200)
        private String itemName;

        @NotNull
        @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
        private BigDecimal amount;

        @Size(max = 500)
        private String description;

        private Long addedByMemberId;

        // For ITEMWISE split - who ordered this item
        private List<Long> assignedMemberIds;
    }

    @Data
    public static class BillItemResponse {
        private Long id;
        private String itemName;
        private BigDecimal amount;
        private String description;
        private String addedByName;
        private LocalDateTime createdAt;
        private List<String> assignedMemberNames;
        private List<Long> assignedMemberIds;
    }

    @Data
    public static class BillSummaryResponse {
        private BigDecimal subtotal;
        private BigDecimal taxAmount;
        private BigDecimal tipAmount;
        private BigDecimal totalAmount;
        private BigDecimal taxPercent;
        private BigDecimal tipPercent;
        private List<MemberShareResponse> memberShares;
    }

    @Data
    public static class MemberShareResponse {
        private Long memberId;
        private String displayName;
        private BigDecimal shareAmount;
        private String paymentStatus;
    }
}
