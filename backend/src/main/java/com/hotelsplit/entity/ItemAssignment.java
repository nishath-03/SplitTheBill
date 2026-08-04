package com.hotelsplit.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "item_assignments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ItemAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_item_id", nullable = false)
    private BillItem billItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_member_id", nullable = false)
    private SessionMember assignedMember;
}
