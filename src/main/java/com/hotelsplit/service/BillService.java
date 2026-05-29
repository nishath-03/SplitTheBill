package com.hotelsplit.service;

import com.hotelsplit.dto.BillDTOs;
import com.hotelsplit.entity.*;
import com.hotelsplit.exception.BadRequestException;
import com.hotelsplit.exception.NotFoundException;
import com.hotelsplit.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillService {

    private final BillItemRepository billItemRepository;
    private final SessionMemberRepository memberRepository;
    private final ItemAssignmentRepository assignmentRepository;
    private final SessionService sessionService;
    private final MapperService mapperService;

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${app.gemini.api-key:}")
    private String geminiApiKey;

    @Transactional
    public BillDTOs.BillItemResponse addBillItem(String roomCode, BillDTOs.AddBillItemRequest request) {
        Session session = sessionService.getSessionByCode(roomCode);

        if (session.getStatus() != Session.SessionStatus.ACTIVE &&
            session.getStatus() != Session.SessionStatus.GRACE_PERIOD) {
            throw new BadRequestException("Can only add items when session is ACTIVE or in GRACE_PERIOD");
        }

        SessionMember addedBy = null;
        if (request.getAddedByMemberId() != null) {
            addedBy = memberRepository.findById(request.getAddedByMemberId()).orElse(null);
        }

        BillItem item = BillItem.builder()
            .session(session)
            .itemName(request.getItemName())
            .amount(request.getAmount())
            .description(request.getDescription())
            .addedBy(addedBy)
            .build();

        item = billItemRepository.save(item);

        // Handle ITEMWISE assignments
        if (request.getAssignedMemberIds() != null && !request.getAssignedMemberIds().isEmpty()) {
            for (Long memberId : request.getAssignedMemberIds()) {
                SessionMember member = memberRepository.findById(memberId)
                    .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
                ItemAssignment assignment = ItemAssignment.builder()
                    .billItem(item)
                    .assignedMember(member)
                    .build();
                assignmentRepository.save(assignment);
            }
        }

        sessionService.broadcastSessionUpdate(roomCode, "ITEM_ADDED",
            Map.of("itemName", item.getItemName(), "amount", item.getAmount()));

        return mapperService.toBillItemResponse(item);
    }

    public List<BillDTOs.BillItemResponse> getBillItems(String roomCode) {
        Session session = sessionService.getSessionByCode(roomCode);
        return billItemRepository.findBySessionId(session.getId())
            .stream()
            .map(mapperService::toBillItemResponse)
            .toList();
    }

    @Transactional
    public void deleteBillItem(Long itemId, Long hostId) {
        BillItem item = billItemRepository.findById(itemId)
            .orElseThrow(() -> new NotFoundException("Bill item not found"));

        sessionService.validateHost(item.getSession(), hostId);

        if (item.getSession().getStatus() != Session.SessionStatus.ACTIVE &&
            item.getSession().getStatus() != Session.SessionStatus.GRACE_PERIOD) {
            throw new BadRequestException("Cannot delete items in current session state");
        }

        assignmentRepository.deleteAll(item.getAssignments());
        billItemRepository.delete(item);
        sessionService.broadcastSessionUpdate(item.getSession().getRoomCode(), "ITEM_REMOVED",
            Map.of("itemId", itemId));
    }

    public List<BillDTOs.BillItemResponse> scanAndAddBillItems(String roomCode, String base64Image, String mimeType) {
        String apiKey = geminiApiKey;
        if (apiKey == null || apiKey.trim().isEmpty()) {
            apiKey = System.getenv("GEMINI_API_KEY");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new BadRequestException("Gemini API Key is not configured. Please set the GEMINI_API_KEY environment variable or app.gemini.api-key in application.properties.");
        }

        // Clean base64 prefix if present (e.g. data:image/jpeg;base64,...)
        if (base64Image.contains(",")) {
            base64Image = base64Image.split(",")[1];
        }

        // Prepare request payload for Gemini API using standard JSON structures
        Map<String, Object> inlineData = Map.of(
            "mimeType", mimeType != null ? mimeType : "image/jpeg",
            "data", base64Image
        );
        Map<String, Object> partText = Map.of(
            "text", "You are an expert restaurant bill analyzer. Your task is to extract all lines from the receipt that contribute to the grand total. This includes:\n" +
                    "1. All individual food and drink items with their corresponding final amounts.\n" +
                    "2. Any taxes (e.g., CGST, SGST, VAT), service charges, container charges, or packaging charges.\n" +
                    "3. Any discounts (represented as negative amounts) or roundings.\n\n" +
                    "Ensure that the sum of all extracted items and taxes perfectly equals the grand total printed on the receipt.\n\n" +
                    "Return a JSON array where each object has 'itemName' (string) and 'amount' (number) fields. Do not return any other text, markdown blocks, or commentary. Only return a raw JSON array."
        );
        Map<String, Object> partImage = Map.of(
            "inlineData", inlineData
        );
        Map<String, Object> contents = Map.of(
            "parts", List.of(partText, partImage)
        );

        // Configure Gemini 1.5 Flash to guarantee valid JSON array output structure
        Map<String, Object> itemSchema = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                "itemName", Map.of("type", "STRING", "description", "The name of the item on the bill"),
                "amount", Map.of("type", "NUMBER", "description", "The amount of the item on the bill")
            ),
            "required", List.of("itemName", "amount")
        );
        Map<String, Object> responseSchema = Map.of(
            "type", "ARRAY",
            "items", itemSchema
        );
        Map<String, Object> generationConfig = Map.of(
            "responseMimeType", "application/json",
            "responseSchema", responseSchema
        );

        Map<String, Object> requestBody = Map.of(
            "contents", List.of(contents),
            "generationConfig", generationConfig
        );

        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            Map body = response.getBody();
            if (body == null) {
                throw new RuntimeException("Empty response from Gemini API");
            }

            // Extract content: candidates[0].content.parts[0].text
            List candidates = (List) body.get("candidates");
            if (candidates == null || candidates.isEmpty()) {
                throw new RuntimeException("No content generated by Gemini API");
            }
            Map candidate = (Map) candidates.get(0);
            Map content = (Map) candidate.get("content");
            List parts = (List) content.get("parts");
            Map part = (Map) parts.get(0);
            String jsonText = (String) part.get("text");

            log.debug("Gemini Extracted JSON: {}", jsonText);

            // Parse extracted text into a structured list of maps
            ObjectMapper mapper = new ObjectMapper();
            List<Map<String, Object>> itemsList = mapper.readValue(jsonText, new TypeReference<List<Map<String, Object>>>() {});

            ArrayList<BillDTOs.BillItemResponse> savedItems = new ArrayList<>();
            for (Map<String, Object> rawItem : itemsList) {
                String itemName = (String) rawItem.get("itemName");
                Object amountObj = rawItem.get("amount");
                java.math.BigDecimal amount;
                if (amountObj instanceof Number) {
                    amount = java.math.BigDecimal.valueOf(((Number) amountObj).doubleValue());
                } else if (amountObj instanceof String) {
                    amount = new java.math.BigDecimal((String) amountObj);
                } else {
                    continue;
                }

                if (itemName == null || itemName.trim().isEmpty()) {
                    continue;
                }

                // Call addBillItem inside the loop to register items
                BillDTOs.AddBillItemRequest addRequest = new BillDTOs.AddBillItemRequest();
                addRequest.setItemName(itemName.trim());
                addRequest.setAmount(amount);
                addRequest.setDescription("Scanned from bill");
                savedItems.add(addBillItem(roomCode, addRequest));
            }

            return savedItems;

        } catch (Exception e) {
            log.error("Failed to call Gemini API", e);
            throw new BadRequestException("Failed to scan bill: " + e.getMessage());
        }
    }
}
