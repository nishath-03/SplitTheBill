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
@Slf4j
public class BillService {

    /** Names that must never be treated as billable items (taxes, discounts, totals, metadata). */
    private static final java.util.regex.Pattern EXCLUDE_ITEM_PATTERN = java.util.regex.Pattern.compile(
        "(?i)^\\s*(cgst|sgst|igst|vat|service\\s+tax|s\\.?\\s*tax|gst|tax|discount|disc|round\\s*off|rounding|packing|packaging|container|delivery|parcel|tip|service\\s+charge|sub[\\s\\-]?total|grand\\s+total|net\\s+total|total\\s+qty|amount\\s+due|amount\\s+payable|total)[:\\s\\d₹%-].*$" +
        "|(?i)^(cgst|sgst|igst|vat|service\\s+tax|s\\.?\\s*tax|gst|tax|discount|disc|round\\s*off|rounding|packing|packaging|container|delivery|parcel|tip|service\\s+charge|sub[\\s\\-]?total|grand\\s+total|net\\s+total|total\\s+qty|amount\\s+due|amount\\s+payable|total)$"
    );

    private static boolean isTotalOrTaxLine(String name) {
        if (name == null || name.trim().isEmpty()) return true;
        String trimmed = name.trim();
        return EXCLUDE_ITEM_PATTERN.matcher(trimmed).matches();
    }

    /**
     * Post-processing validation & normalization layer for Gemini extracted items.
     * 1. Filters out tax/summary/metadata lines if AI accidentally included them in items.
     * 2. Detects duplicate detections where AI split (Rate, Total) into two separate items for the same product.
     * 3. Merges duplicates into a single item (preferring line total as totalPrice and rate as unitPrice).
     */
    private List<Map<String, Object>> normalizeAndDeduplicateItems(List<Map<String, Object>> rawItems) {
        if (rawItems == null || rawItems.isEmpty()) return new ArrayList<>();

        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> item : rawItems) {
            String name = (String) item.get("name");
            if (name == null || name.trim().isEmpty()) continue;
            if (isTotalOrTaxLine(name)) {
                log.info("Post-processing filtered out non-item line: '{}'", name);
                continue;
            }
            filtered.add(item);
        }

        Map<String, Map<String, Object>> mergedMap = new java.util.LinkedHashMap<>();

        for (Map<String, Object> item : filtered) {
            String name = ((String) item.get("name")).trim();
            String normKey = name.toLowerCase().replaceAll("[^a-z0-9]", "");

            double unitPrice = item.get("unitPrice") instanceof Number ? ((Number) item.get("unitPrice")).doubleValue() : 0.0;
            double totalPrice = item.get("totalPrice") instanceof Number ? ((Number) item.get("totalPrice")).doubleValue() : 0.0;

            if (mergedMap.containsKey(normKey)) {
                Map<String, Object> existing = mergedMap.get(normKey);
                double existingUnit = existing.get("unitPrice") instanceof Number ? ((Number) existing.get("unitPrice")).doubleValue() : 0.0;
                double existingTotal = existing.get("totalPrice") instanceof Number ? ((Number) existing.get("totalPrice")).doubleValue() : 0.0;

                double finalUnitPrice = Math.min(
                    unitPrice > 0 ? unitPrice : totalPrice,
                    existingUnit > 0 ? existingUnit : existingTotal
                );
                double finalTotalPrice = Math.max(totalPrice, existingTotal);

                existing.put("unitPrice", finalUnitPrice);
                existing.put("totalPrice", finalTotalPrice);
                log.info("Post-processing merged duplicate item '{}': unitPrice={}, totalPrice={}", name, finalUnitPrice, finalTotalPrice);
            } else {
                mergedMap.put(normKey, item);
            }
        }

        return new ArrayList<>(mergedMap.values());
    }

    private final BillItemRepository billItemRepository;
    private final SessionMemberRepository memberRepository;
    private final ItemAssignmentRepository assignmentRepository;
    private final SessionService sessionService;
    private final MapperService mapperService;
    private final RestTemplate restTemplate;

    public BillService(BillItemRepository billItemRepository,
                       SessionMemberRepository memberRepository,
                       ItemAssignmentRepository assignmentRepository,
                       SessionService sessionService,
                       MapperService mapperService) {
        this.billItemRepository = billItemRepository;
        this.memberRepository = memberRepository;
        this.assignmentRepository = assignmentRepository;
        this.sessionService = sessionService;
        this.mapperService = mapperService;

        org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(30000);
        factory.setReadTimeout(60000);
        this.restTemplate = new RestTemplate(factory);
    }

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

    public List<BillDTOs.BillItemResponse> scanAndAddBillItems(String roomCode, String base64Image, String mimeType, String clientApiKey) {
        // Priority: 1) key sent from UI, 2) application.properties, 3) GEMINI_API_KEY env var
        String apiKey = (clientApiKey != null && !clientApiKey.trim().isEmpty()) ? clientApiKey.trim() : geminiApiKey;
        if (apiKey == null || apiKey.trim().isEmpty()) {
            apiKey = System.getenv("GEMINI_API_KEY");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new BadRequestException("Gemini API Key is not configured. Please enter your Gemini API key in the Scan Bill dialog.");
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
            "text", "You are an expert restaurant receipt analyzer. Analyze the physical receipt image carefully.\n\n" +
                    "TABLE STRUCTURE RULES:\n" +
                    "- Each row in the itemized table represents EXACTLY ONE purchased food or drink item.\n" +
                    "- Map receipt columns as: Item/Description -> 'name', Qty -> 'quantity', Rate/Unit Price -> 'unitPrice', Total/Amount -> 'totalPrice'.\n" +
                    "- If both Rate (unit price) and Total (line price) columns exist, extract BOTH into the same item object. NEVER create two separate item objects for Rate and Total!\n" +
                    "- Example: 'Tandoori Chicken  1  295.00  309.75' MUST produce ONE item object: {\"name\": \"Tandoori Chicken\", \"quantity\": 1, \"unitPrice\": 295.0, \"totalPrice\": 309.75}.\n\n" +
                    "EXCLUSION RULES:\n" +
                    "- Do NOT include CGST, SGST, IGST, VAT, Service Tax, Discounts, Round Off, Packing Charges, Delivery Charges, Tips, Subtotal, or Grand Total in the 'items' array.\n" +
                    "- Put tax totals in 'tax', subtotal in 'subtotal', and grand total in 'grandTotal'.\n" +
                    "- Do NOT extract metadata (GSTIN, Phone, Address, Invoice No) as purchased items.\n\n" +
                    "Return ONLY a JSON object strictly matching the required schema."
        );
        Map<String, Object> partImage = Map.of(
            "inlineData", inlineData
        );
        Map<String, Object> contents = Map.of(
            "parts", List.of(partText, partImage)
        );

        // Configure Gemini 2.5 Flash to guarantee valid JSON object output structure
        Map<String, Object> itemSchema = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                "name", Map.of("type", "STRING", "description", "Name of the purchased food/drink item"),
                "quantity", Map.of("type", "NUMBER", "description", "Quantity ordered"),
                "unitPrice", Map.of("type", "NUMBER", "description", "Unit rate per item"),
                "totalPrice", Map.of("type", "NUMBER", "description", "Final line total amount")
            ),
            "required", List.of("name", "quantity", "unitPrice", "totalPrice")
        );
        Map<String, Object> responseSchema = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                "merchant", Map.of("type", "STRING"),
                "invoiceNumber", Map.of("type", "STRING"),
                "date", Map.of("type", "STRING"),
                "currency", Map.of("type", "STRING"),
                "subtotal", Map.of("type", "NUMBER"),
                "tax", Map.of("type", "NUMBER"),
                "grandTotal", Map.of("type", "NUMBER"),
                "items", Map.of(
                    "type", "ARRAY",
                    "items", itemSchema
                )
            ),
            "required", List.of("merchant", "invoiceNumber", "date", "currency", "items", "subtotal", "tax", "grandTotal")
        );
        Map<String, Object> generationConfig = Map.of(
            "responseMimeType", "application/json",
            "responseSchema", responseSchema
        );

        Map<String, Object> requestBody = Map.of(
            "contents", List.of(contents),
            "generationConfig", generationConfig
        );

        String modelName = "gemini-2.5-flash";
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;

        try {
            log.info("Gemini model: {}", modelName);
            log.info("MIME type: {}", mimeType != null ? mimeType : "image/jpeg");
            log.info("Image size: {} characters (base64)", base64Image.length());
            log.info("Calling Gemini...");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            log.info("Gemini HTTP status: {}", response.getStatusCode());

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

            log.info("Gemini response: {}", jsonText);

            // Parse extracted text into our structured Object
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> parsedResponse = mapper.readValue(jsonText, new TypeReference<Map<String, Object>>() {});
            
            // Extract the items array
            List<Map<String, Object>> rawItemsList = (List<Map<String, Object>>) parsedResponse.get("items");
            
            // Apply Post-Processing Normalization & Deduplication Layer
            List<Map<String, Object>> normalizedItems = normalizeAndDeduplicateItems(rawItemsList);

            ArrayList<BillDTOs.BillItemResponse> savedItems = new ArrayList<>();
            for (Map<String, Object> rawItem : normalizedItems) {
                String itemName = (String) rawItem.get("name");
                Object amountObj = rawItem.get("totalPrice");
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

        } catch (org.springframework.web.client.HttpClientErrorException.NotFound e) {
            log.error("Gemini Model Not Found (404 Error): {}", e.getResponseBodyAsString(), e);
            throw new BadRequestException("Gemini API Error (404): Model gemini-2.5-flash not found or not supported for generateContent. Response: " + e.getResponseBodyAsString());
        } catch (org.springframework.web.client.RestClientResponseException e) {
            log.error("Gemini API HTTP Error: {} {}", e.getStatusCode(), e.getStatusText());
            log.error("API Response Body: {}", e.getResponseBodyAsString());
            log.error("Full Exception Stack Trace:", e);
            throw new BadRequestException("Gemini API Error (" + e.getStatusCode() + "): " + e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("Unexpected error during Gemini Vision API call", e);
            throw new BadRequestException("Failed to scan bill: " + e.getMessage());
        }
    }

    /**
     * Parses raw OCR text with Gemini (text-only, no image).
     * Much cheaper / fewer tokens than the image API.
     * Returns raw item maps WITHOUT saving anything to the database.
     */
    public List<Map<String, Object>> parseTextWithGemini(String rawText, String clientApiKey) {
        String apiKey = (clientApiKey != null && !clientApiKey.trim().isEmpty()) ? clientApiKey.trim() : geminiApiKey;
        if (apiKey == null || apiKey.trim().isEmpty()) {
            apiKey = System.getenv("GEMINI_API_KEY");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new BadRequestException("Gemini API Key not configured.");
        }

        String prompt = "You are an expert restaurant receipt parser. The text below was extracted via OCR from a physical receipt.\n" +
            "Your task: extract every food and drink line item with its total price.\n" +
            "Return ONLY a JSON array, no markdown fences, no explanation:\n" +
            "[{\"itemName\":\"Masala Dosa\",\"amount\":499.0}, ...]\n\n" +
            "Rules:\n" +
            "- Include individual food/drink items AND any extra charges like CGST, SGST, IGST, VAT, service charge, packaging, or discounts\n" +
            "- Do NOT include subtotal, grand total, amount payable, or amount due lines (these cause double-counting)\n" +
            "- Use the row-level total (qty x unit price) as the amount\n" +
            "- Fix obvious OCR typos in item names (e.g. '0osa' → 'Dosa')\n" +
            "- If the same item appears multiple times, keep each row separately\n\n" +
            "OCR TEXT:\n" + rawText;

        Map<String, Object> textPart = Map.of("text", prompt);
        Map<String, Object> contents = Map.of("parts", List.of(textPart));

        Map<String, Object> itemSchema = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                "itemName", Map.of("type", "STRING"),
                "amount",   Map.of("type", "NUMBER")
            ),
            "required", List.of("itemName", "amount")
        );
        Map<String, Object> generationConfig = Map.of(
            "responseMimeType", "application/json",
            "responseSchema", Map.of("type", "ARRAY", "items", itemSchema)
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
            if (body == null) throw new RuntimeException("Empty response from Gemini API");

            List candidates = (List) body.get("candidates");
            if (candidates == null || candidates.isEmpty()) throw new RuntimeException("No content generated by Gemini");

            Map candidate = (Map) candidates.get(0);
            Map content  = (Map) candidate.get("content");
            List parts   = (List) content.get("parts");
            String jsonText = (String) ((Map) parts.get(0)).get("text");

            log.debug("Gemini text-parse JSON: {}", jsonText);

            ObjectMapper mapper = new ObjectMapper();
            List<Map<String, Object>> raw = mapper.readValue(jsonText, new TypeReference<List<Map<String, Object>>>() {});

            // Filter out any total/subtotal/tax rows the AI accidentally included
            return raw.stream()
                .filter(item -> !isTotalOrTaxLine(String.valueOf(item.getOrDefault("itemName", ""))))
                .collect(java.util.stream.Collectors.toList());

        } catch (Exception e) {
            log.error("Failed to parse text with Gemini", e);
            throw new BadRequestException("Gemini text parse failed: " + e.getMessage());
        }
    }
}
