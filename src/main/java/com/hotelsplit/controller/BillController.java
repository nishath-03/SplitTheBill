package com.hotelsplit.controller;

import com.hotelsplit.dto.BillDTOs;
import com.hotelsplit.entity.User;
import com.hotelsplit.service.BillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sessions/{roomCode}/items")
@RequiredArgsConstructor
public class BillController {

    private final BillService billService;

    @PostMapping
    public ResponseEntity<BillDTOs.BillItemResponse> addItem(
            @PathVariable String roomCode,
            @Valid @RequestBody BillDTOs.AddBillItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(billService.addBillItem(roomCode, request));
    }

    @GetMapping
    public ResponseEntity<List<BillDTOs.BillItemResponse>> getItems(
            @PathVariable String roomCode) {
        return ResponseEntity.ok(billService.getBillItems(roomCode));
    }

    @DeleteMapping("/{itemId}")
    public ResponseEntity<Map<String, String>> deleteItem(
            @PathVariable String roomCode,
            @PathVariable Long itemId,
            @AuthenticationPrincipal User user) {
        billService.deleteBillItem(itemId, user.getId());
        return ResponseEntity.ok(Map.of("message", "Item deleted"));
    }

    @PostMapping("/scan-bill")
    public ResponseEntity<List<BillDTOs.BillItemResponse>> scanBill(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> payload) {
        String base64Image = payload.get("image");
        String mimeType = payload.get("mimeType");
        return ResponseEntity.ok(billService.scanAndAddBillItems(roomCode, base64Image, mimeType));
    }
}
