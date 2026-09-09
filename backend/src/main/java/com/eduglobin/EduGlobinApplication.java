package com.eduglobin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EduGlobinApplication {

    public static void main(String[] args) {
        SpringApplication.run(EduGlobinApplication.class, args);
    }
}
