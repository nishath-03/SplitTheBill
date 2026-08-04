package com.hotelsplit.dto;

import com.hotelsplit.entity.Session;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class SessionDTOs {

    @Data
    public static class CreateSessionRequest {
        @NotBlank(message = "Hotel name is required")
        @Size(max = 200)
        private String hotelName;

        @Size(max = 50)
        private String tableNumber;

        @NotNull
        private Session.SplitType splitType;

        private String currency = "INR";

        @DecimalMin("0") @DecimalMax("50")
        private BigDecimal taxPercent = BigDecimal.ZERO;

        @DecimalMin("0") @DecimalMax("50")
        private BigDecimal tipPercent = BigDecimal.ZERO;

        @Min(15) @Max(480)
        private Integer durationMinutes = 120;

        @Size(max = 100)
        private String hostUpiId;

        private Boolean includeHost = true;
    }

    @Data
    public static class SessionResponse {
        private Long id;
        private String roomCode;
        private String hotelName;
        private String tableNumber;
        private Session.SplitType splitType;
        private String currency;
        private BigDecimal taxPercent;
        private BigDecimal tipPercent;
        private Session.SessionStatus status;
        private Integer durationMinutes;
        private LocalDateTime startedAt;
        private LocalDateTime closedAt;
        private LocalDateTime createdAt;
        private String hostName;
        private Long hostId;
        private String hostUpiId;
        private String razorpayKeyId;
        private String qrCodeBase64;
        private String pdfUrl;
        private Boolean includeHost;
        private List<MemberDTOs.MemberResponse> members;
        private List<BillDTOs.BillItemResponse> billItems;
        private BigDecimal totalAmount;
    }

    @Data
    public static class UpdateTaxTipRequest {
        @DecimalMin("0") @DecimalMax("50")
        private BigDecimal taxPercent;

        @DecimalMin("0") @DecimalMax("50")
        private BigDecimal tipPercent;

        @Size(max = 100)
        private String hostUpiId;

        @Size(max = 100)
        private String razorpayKeyId;

        private com.hotelsplit.entity.Session.SplitType splitType;
        private Boolean includeHost;
    }
}
