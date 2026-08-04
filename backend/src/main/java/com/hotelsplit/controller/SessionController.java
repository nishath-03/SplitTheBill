package com.hotelsplit.controller;

import com.hotelsplit.dto.BillDTOs;
import com.hotelsplit.dto.SessionDTOs;
import com.hotelsplit.entity.User;
import com.hotelsplit.service.SessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @PostMapping
    public ResponseEntity<SessionDTOs.SessionResponse> createSession(
            @Valid @RequestBody SessionDTOs.CreateSessionRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(sessionService.createSession(request, user.getId()));
    }

    @GetMapping("/{roomCode}")
    public ResponseEntity<SessionDTOs.SessionResponse> getSession(
            @PathVariable String roomCode,
            @RequestParam(defaultValue = "false") boolean includeQr) {
        return ResponseEntity.ok(sessionService.getSession(roomCode, includeQr));
    }

    @GetMapping("/my")
    public ResponseEntity<List<SessionDTOs.SessionResponse>> getMySessions(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(sessionService.getHostSessions(user.getId()));
    }

    @PostMapping("/{roomCode}/start")
    public ResponseEntity<SessionDTOs.SessionResponse> startSession(
            @PathVariable String roomCode,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(sessionService.startSession(roomCode, user.getId()));
    }

    @PostMapping("/{roomCode}/close")
    public ResponseEntity<SessionDTOs.SessionResponse> closeSession(
            @PathVariable String roomCode,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(sessionService.closeSession(roomCode, user.getId()));
    }

    @PostMapping("/{roomCode}/calculate")
    public ResponseEntity<BillDTOs.BillSummaryResponse> calculateSplit(
            @PathVariable String roomCode,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(sessionService.calculateAndDistribute(roomCode, user.getId()));
    }

    @PatchMapping("/{roomCode}/tax-tip")
    public ResponseEntity<SessionDTOs.SessionResponse> updateTaxTip(
            @PathVariable String roomCode,
            @Valid @RequestBody SessionDTOs.UpdateTaxTipRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(sessionService.updateTaxTip(roomCode, user.getId(), request));
    }

    @PostMapping("/{roomCode}/settle")
    public ResponseEntity<Map<String, String>> settleSession(
            @PathVariable String roomCode,
            @AuthenticationPrincipal User user) {
        sessionService.settleSession(roomCode, user.getId());
        return ResponseEntity.ok(Map.of("message", "Session settled successfully"));
    }
}
