package com.hotelsplit.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "session_members")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private Session session;

    @Column(nullable = false, length = 100)
    private String displayName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;  // null for guests

    @Column(nullable = false)
    private Boolean isHost = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @Column(precision = 10, scale = 2)
    private BigDecimal shareAmount;

    @CreationTimestamp
    private LocalDateTime joinedAt;

    @OneToMany(mappedBy = "assignedMember", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ItemAssignment> itemAssignments = new ArrayList<>();

    public enum PaymentStatus {
        PENDING, MARKED, CONFIRMED, REJECTED
    }
}
