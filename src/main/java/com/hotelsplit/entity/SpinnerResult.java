package com.hotelsplit.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "spinner_results")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SpinnerResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private Session session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "winner_member_id", nullable = false)
    private SessionMember winner;

    @Column(length = 200)
    private String reason;

    @CreationTimestamp
    private LocalDateTime spunAt;
}
