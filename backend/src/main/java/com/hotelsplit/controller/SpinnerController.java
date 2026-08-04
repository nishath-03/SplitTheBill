package com.hotelsplit.controller;

import com.hotelsplit.entity.User;
import com.hotelsplit.service.SpinnerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sessions/{roomCode}/spin")
@RequiredArgsConstructor
public class SpinnerController {

    private final SpinnerService spinnerService;

    @PostMapping
    public ResponseEntity<SpinnerService.SpinResult> spin(
            @PathVariable String roomCode,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(spinnerService.spin(roomCode, user.getId(), reason));
    }

    @GetMapping("/history")
    public ResponseEntity<?> getSpinHistory(@PathVariable String roomCode) {
        return ResponseEntity.ok(spinnerService.getSpinHistory(roomCode));
    }
}
