package com.hotelsplit.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class AuthDTOs {

    @Data
    public static class RegisterRequest {
        @Email(message = "Valid email is required")
        @NotBlank
        private String email;

        @NotBlank
        @Size(min = 6, message = "Password must be at least 6 characters")
        private String password;

        @NotBlank
        @Size(min = 2, max = 50, message = "Display name must be 2-50 characters")
        private String displayName;
    }

    @Data
    public static class LoginRequest {
        @Email
        @NotBlank
        private String email;

        @NotBlank
        private String password;
    }

    @Data
    public static class AuthResponse {
        private String accessToken;
        private String tokenType = "Bearer";
        private Long userId;
        private String email;
        private String displayName;

        public AuthResponse(String accessToken, Long userId, String email, String displayName) {
            this.accessToken = accessToken;
            this.userId = userId;
            this.email = email;
            this.displayName = displayName;
        }
    }

    @Data
    public static class GoogleLoginRequest {
        @NotBlank(message = "Google credential token is required")
        private String credential;
    }
}
