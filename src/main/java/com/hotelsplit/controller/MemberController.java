package com.hotelsplit.controller;

import com.hotelsplit.dto.MemberDTOs;
import com.hotelsplit.entity.User;
import com.hotelsplit.service.MemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @PostMapping("/sessions/{roomCode}/join")
    public ResponseEntity<MemberDTOs.JoinResponse> joinSession(
            @PathVariable String roomCode,
            @Valid @RequestBody MemberDTOs.JoinRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(memberService.joinSession(roomCode, request));
    }

    @GetMapping("/sessions/{roomCode}/members")
    public ResponseEntity<List<MemberDTOs.MemberResponse>> getMembers(
            @PathVariable String roomCode) {
        return ResponseEntity.ok(memberService.getMembers(roomCode));
    }

    @PostMapping("/members/{memberId}/mark-paid")
    public ResponseEntity<Map<String, String>> markAsPaid(@PathVariable Long memberId) {
        memberService.markAsPaid(memberId);
        return ResponseEntity.ok(Map.of("message", "Payment marked successfully"));
    }

    @PostMapping("/members/{memberId}/confirm-razorpay")
    public ResponseEntity<Map<String, String>> confirmRazorpay(
            @PathVariable Long memberId,
            @RequestBody Map<String, String> payload) {
        String paymentId = payload.get("razorpayPaymentId");
        memberService.confirmRazorpayPayment(memberId, paymentId);
        return ResponseEntity.ok(Map.of("message", "Payment verified and confirmed via Razorpay"));
    }

    @PostMapping("/members/{memberId}/confirm")
    public ResponseEntity<Map<String, String>> confirmPayment(
            @PathVariable Long memberId,
            @AuthenticationPrincipal User user) {
        memberService.confirmPayment(memberId, user.getId());
        return ResponseEntity.ok(Map.of("message", "Payment confirmed"));
    }

    @PostMapping("/members/{memberId}/reject")
    public ResponseEntity<Map<String, String>> rejectPayment(
            @PathVariable Long memberId,
            @AuthenticationPrincipal User user) {
        memberService.rejectPayment(memberId, user.getId());
        return ResponseEntity.ok(Map.of("message", "Payment rejected"));
    }
}
