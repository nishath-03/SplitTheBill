package com.hotelsplit.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "sessions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 6)
    private String roomCode;

    @Column(nullable = false, length = 200)
    private String hotelName;

    @Column(length = 50)
    private String tableNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SplitType splitType;

    @Column(length = 3)
    private String currency = "INR";

    @Column(precision = 5, scale = 2)
    private BigDecimal taxPercent = BigDecimal.ZERO;

    @Column(precision = 5, scale = 2)
    private BigDecimal tipPercent = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status = SessionStatus.WAITING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @Column(nullable = false)
    private Integer durationMinutes = 120;

    private LocalDateTime startedAt;
    private LocalDateTime closedAt;
    private String pdfUrl;
    
    @Column(length = 100)
    private String hostUpiId;

    @Column(nullable = false)
    @Builder.Default
    private Boolean includeHost = true;

    @Column(length = 100)
    private String razorpayKeyId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<SessionMember> members = new ArrayList<>();

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<BillItem> billItems = new ArrayList<>();

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<SpinnerResult> spinnerResults = new ArrayList<>();

    public enum SplitType {
        EQUAL, ITEMWISE, PERCENTAGE
    }

    public enum SessionStatus {
        WAITING, ACTIVE, GRACE_PERIOD, COLLECTING, SETTLED
    }
}
