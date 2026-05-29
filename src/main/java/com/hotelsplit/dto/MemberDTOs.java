package com.hotelsplit.dto;

import com.hotelsplit.entity.SessionMember;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class MemberDTOs {

    @Data
    public static class JoinRequest {
        @NotBlank(message = "Display name is required")
        @Size(min = 2, max = 50, message = "Name must be 2-50 characters")
        private String displayName;
    }

    @Data
    public static class MemberResponse {
        private Long id;
        private String displayName;
        private Boolean isHost;
        private SessionMember.PaymentStatus paymentStatus;
        private BigDecimal shareAmount;
        private LocalDateTime joinedAt;
    }

    @Data
    public static class JoinResponse {
        private Long memberId;
        private String displayName;
        private String roomCode;
        private String sessionStatus;
        private String hotelName;
        private String guestToken;  // simple token for guest to identify themselves
    }
}
