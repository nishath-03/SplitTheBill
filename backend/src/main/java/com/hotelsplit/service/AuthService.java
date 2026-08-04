package com.hotelsplit.service;

import com.hotelsplit.dto.AuthDTOs;
import com.hotelsplit.entity.User;
import com.hotelsplit.exception.ConflictException;
import com.hotelsplit.exception.UnauthorizedException;
import com.hotelsplit.repository.UserRepository;
import com.hotelsplit.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestTemplate;
import com.hotelsplit.exception.BadRequestException;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Value("${app.google.client-id:}")
    private String googleClientId;

    private final RestTemplate restTemplate = new RestTemplate();

    @Transactional
    public AuthDTOs.AuthResponse register(AuthDTOs.RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("Email already registered: " + request.getEmail());
        }

        User user = User.builder()
            .email(request.getEmail())
            .passwordHash(passwordEncoder.encode(request.getPassword()))
            .displayName(request.getDisplayName())
            .build();

        user = userRepository.save(user);
        log.info("New user registered: {}", user.getEmail());

        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        return new AuthDTOs.AuthResponse(token, user.getId(), user.getEmail(), user.getDisplayName());
    }

    public AuthDTOs.AuthResponse login(AuthDTOs.LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        return new AuthDTOs.AuthResponse(token, user.getId(), user.getEmail(), user.getDisplayName());
    }

    @Transactional
    public AuthDTOs.AuthResponse googleLogin(String credential) {
        String tokenInfoUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + credential;
        Map response;
        try {
            response = restTemplate.getForObject(tokenInfoUrl, Map.class);
        } catch (Exception e) {
            log.error("Google token verification failed", e);
            throw new UnauthorizedException("Failed to verify Google credentials: " + e.getMessage());
        }

        if (response == null || response.containsKey("error_description")) {
            throw new UnauthorizedException("Invalid Google token");
        }

        String email = (String) response.get("email");
        String displayName = (String) response.get("name");
        String aud = (String) response.get("aud");

        if (email == null || email.trim().isEmpty()) {
            throw new BadRequestException("Google account must have an email address");
        }

        // Verify audience matches if backend is configured
        if (googleClientId != null && !googleClientId.trim().isEmpty()) {
            if (!googleClientId.trim().equals(aud)) {
                log.warn("Google OAuth audience mismatch: expected {}, got {}", googleClientId, aud);
                throw new UnauthorizedException("Invalid Google token audience");
            }
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            user = User.builder()
                .email(email)
                .displayName(displayName != null ? displayName : email.split("@")[0])
                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                .build();
            user = userRepository.save(user);
            log.info("New Google OAuth user created: {}", email);
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        return new AuthDTOs.AuthResponse(token, user.getId(), user.getEmail(), user.getDisplayName());
    }
}
