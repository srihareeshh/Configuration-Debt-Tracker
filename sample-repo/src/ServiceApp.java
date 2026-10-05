package com.example.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ServiceApp {

    // Spring annotation injecting property from application.yml
    @Value("${database.url}")
    private String databaseUrl;

    public void execute() {
        String timeout = System.getenv("API_TIMEOUT");
        System.out.println("Executing service with timeout: " + timeout);
    }
}
