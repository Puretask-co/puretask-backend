"use strict";
// src/core/index.ts
// Core Systems v2 - Main Export File
//
// This file exports all core system services and types for use throughout the application
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RollingWindowService = exports.AvailabilityService = exports.FlexibilityService = exports.InconvenienceService = exports.REASON_CODES = exports.ReasonCodeService = exports.MatchingService = exports.cancelJobSimple = exports.CancellationServiceV2 = exports.RescheduleServiceV2 = exports.ReliabilityScoreV2Service = exports.ClientRiskService = exports.MATCHING_CONFIG = exports.AVAILABILITY_CONFIG = exports.FLEXIBILITY_CONFIG = exports.RESCHEDULE_CONFIG = exports.RELIABILITY_CONFIG = exports.CLIENT_RISK_CONFIG = exports.CANCELLATION_CONFIG = exports.getCreditRateRangeForTier = exports.getPayoutPercentForTier = exports.computeReliabilityBasePoints = exports.computeReliabilityTier = exports.computeRiskBand = exports.clampScore = exports.bucketToString = exports.baseFeePctForWindow = exports.computeWindow = exports.computeHoursBeforeStart = exports.getTimeBucket = exports.daysAgo = exports.minutesDiff = exports.hoursDiff = void 0;
// ============================================
// Types
// ============================================
__exportStar(require("./types"), exports);
// ============================================
// Utilities
// ============================================
var timeBuckets_1 = require("./timeBuckets");
Object.defineProperty(exports, "hoursDiff", { enumerable: true, get: function () { return timeBuckets_1.hoursDiff; } });
Object.defineProperty(exports, "minutesDiff", { enumerable: true, get: function () { return timeBuckets_1.minutesDiff; } });
Object.defineProperty(exports, "daysAgo", { enumerable: true, get: function () { return timeBuckets_1.daysAgo; } });
Object.defineProperty(exports, "getTimeBucket", { enumerable: true, get: function () { return timeBuckets_1.getTimeBucket; } });
Object.defineProperty(exports, "computeHoursBeforeStart", { enumerable: true, get: function () { return timeBuckets_1.computeHoursBeforeStart; } });
Object.defineProperty(exports, "computeWindow", { enumerable: true, get: function () { return timeBuckets_1.computeWindow; } });
Object.defineProperty(exports, "baseFeePctForWindow", { enumerable: true, get: function () { return timeBuckets_1.baseFeePctForWindow; } });
Object.defineProperty(exports, "bucketToString", { enumerable: true, get: function () { return timeBuckets_1.bucketToString; } });
var scoring_1 = require("./scoring");
Object.defineProperty(exports, "clampScore", { enumerable: true, get: function () { return scoring_1.clampScore; } });
Object.defineProperty(exports, "computeRiskBand", { enumerable: true, get: function () { return scoring_1.computeRiskBand; } });
Object.defineProperty(exports, "computeReliabilityTier", { enumerable: true, get: function () { return scoring_1.computeReliabilityTier; } });
Object.defineProperty(exports, "computeReliabilityBasePoints", { enumerable: true, get: function () { return scoring_1.computeReliabilityBasePoints; } });
Object.defineProperty(exports, "getPayoutPercentForTier", { enumerable: true, get: function () { return scoring_1.getPayoutPercentForTier; } });
Object.defineProperty(exports, "getCreditRateRangeForTier", { enumerable: true, get: function () { return scoring_1.getCreditRateRangeForTier; } });
// ============================================
// Configuration
// ============================================
var config_1 = require("./config");
Object.defineProperty(exports, "CANCELLATION_CONFIG", { enumerable: true, get: function () { return config_1.CANCELLATION_CONFIG; } });
Object.defineProperty(exports, "CLIENT_RISK_CONFIG", { enumerable: true, get: function () { return config_1.CLIENT_RISK_CONFIG; } });
Object.defineProperty(exports, "RELIABILITY_CONFIG", { enumerable: true, get: function () { return config_1.RELIABILITY_CONFIG; } });
Object.defineProperty(exports, "RESCHEDULE_CONFIG", { enumerable: true, get: function () { return config_1.RESCHEDULE_CONFIG; } });
Object.defineProperty(exports, "FLEXIBILITY_CONFIG", { enumerable: true, get: function () { return config_1.FLEXIBILITY_CONFIG; } });
Object.defineProperty(exports, "AVAILABILITY_CONFIG", { enumerable: true, get: function () { return config_1.AVAILABILITY_CONFIG; } });
Object.defineProperty(exports, "MATCHING_CONFIG", { enumerable: true, get: function () { return config_1.MATCHING_CONFIG; } });
// ============================================
// Services
// ============================================
// 1.1 Client Risk Score System
var clientRiskService_1 = require("./clientRiskService");
Object.defineProperty(exports, "ClientRiskService", { enumerable: true, get: function () { return clientRiskService_1.ClientRiskService; } });
// 1.2 Reliability Score 2.0
var reliabilityScoreV2Service_1 = require("./reliabilityScoreV2Service");
Object.defineProperty(exports, "ReliabilityScoreV2Service", { enumerable: true, get: function () { return reliabilityScoreV2Service_1.ReliabilityScoreV2Service; } });
// 1.3 Rescheduling System
var rescheduleService_1 = require("./rescheduleService");
Object.defineProperty(exports, "RescheduleServiceV2", { enumerable: true, get: function () { return rescheduleService_1.RescheduleServiceV2; } });
// 1.4 Cancellation System
var cancellationService_1 = require("./cancellationService");
Object.defineProperty(exports, "CancellationServiceV2", { enumerable: true, get: function () { return cancellationService_1.CancellationServiceV2; } });
Object.defineProperty(exports, "cancelJobSimple", { enumerable: true, get: function () { return cancellationService_1.cancelJobSimple; } });
// 1.5 Matching System
var matchingService_1 = require("./matchingService");
Object.defineProperty(exports, "MatchingService", { enumerable: true, get: function () { return matchingService_1.MatchingService; } });
// 2.1 Reason Code System
var reasonCodeService_1 = require("./reasonCodeService");
Object.defineProperty(exports, "ReasonCodeService", { enumerable: true, get: function () { return reasonCodeService_1.ReasonCodeService; } });
Object.defineProperty(exports, "REASON_CODES", { enumerable: true, get: function () { return reasonCodeService_1.REASON_CODES; } });
// 2.2 Inconvenience Score System
var inconvenienceService_1 = require("./inconvenienceService");
Object.defineProperty(exports, "InconvenienceService", { enumerable: true, get: function () { return inconvenienceService_1.InconvenienceService; } });
// 2.3 & 2.4 Flexibility Systems
var flexibilityService_1 = require("./flexibilityService");
Object.defineProperty(exports, "FlexibilityService", { enumerable: true, get: function () { return flexibilityService_1.FlexibilityService; } });
// 2.5 Cleaner Availability System
var availabilityService_1 = require("./availabilityService");
Object.defineProperty(exports, "AvailabilityService", { enumerable: true, get: function () { return availabilityService_1.AvailabilityService; } });
// 2.6 Rolling Window System
var rollingWindowService_1 = require("./rollingWindowService");
Object.defineProperty(exports, "RollingWindowService", { enumerable: true, get: function () { return rollingWindowService_1.RollingWindowService; } });
