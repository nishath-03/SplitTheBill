package com.hotelsplit;

import com.hotelsplit.entity.User;
import com.hotelsplit.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
@EnableScheduling
public class HotelsplitApplication {
    public static void main(String[] args) {
        SpringApplication.run(HotelsplitApplication.class, args);
    }

    @Bean
    public CommandLineRunner initUser(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            userRepository.findByEmail("nishatharumugam3@gmail.com").ifPresent(user -> {
                user.setPasswordHash(passwordEncoder.encode("123456"));
                userRepository.save(user);
                System.out.println(">>> SUCCESSFULLY RESET PASSWORD FOR nishatharumugam3@gmail.com TO '123456' <<<");
            });
        };
    }
}
