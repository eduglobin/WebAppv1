package com.eduglobin.pricing;

import java.math.BigDecimal;

public class PricingSuggestion {
    private String action; // INCREASE, DECREASE
    private BigDecimal suggestedAdjustmentPct;
    private String rationale;

    public PricingSuggestion(String action, BigDecimal suggestedAdjustmentPct, String rationale) {
        this.action = action;
        this.suggestedAdjustmentPct = suggestedAdjustmentPct;
        this.rationale = rationale;
    }

    // getters and setters
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public BigDecimal getSuggestedAdjustmentPct() { return suggestedAdjustmentPct; }
    public void setSuggestedAdjustmentPct(BigDecimal suggestedAdjustmentPct) { this.suggestedAdjustmentPct = suggestedAdjustmentPct; }
    public String getRationale() { return rationale; }
    public void setRationale(String rationale) { this.rationale = rationale; }
}
