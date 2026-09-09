package com.eduglobin.library;

import com.eduglobin.booking.PassType;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

public class LockerServiceTest {

    private final NamedParameterJdbcTemplate jdbcTemplate = Mockito.mock(NamedParameterJdbcTemplate.class);
    private final LockerService lockerService = new LockerService(jdbcTemplate);

    @Test
    public void testResolveLockerFeeFreeLockers() {
        Locker locker = new Locker();
        locker.setPriceHourly(new BigDecimal("10.00"));
        locker.setPriceDaily(new BigDecimal("50.00"));

        BigDecimal fee = lockerService.resolveLockerFee(locker, PassType.DAILY, LockerMode.FREE_LOCKERS);
        assertEquals(BigDecimal.ZERO, fee);
    }

    @Test
    public void testResolveLockerFeeNoLockers() {
        Locker locker = new Locker();
        BigDecimal fee = lockerService.resolveLockerFee(locker, PassType.DAILY, LockerMode.NO_LOCKERS);
        assertNull(fee);
    }

    @Test
    public void testResolveLockerFeePaidManaged() {
        Locker locker = new Locker();
        locker.setPriceHourly(new BigDecimal("5.00"));
        locker.setPriceDaily(new BigDecimal("20.00"));
        locker.setPriceWeekly(new BigDecimal("80.00"));
        locker.setPriceMonthly(new BigDecimal("250.00"));

        BigDecimal hourlyFee = lockerService.resolveLockerFee(locker, PassType.HOURLY, LockerMode.PAID_MANAGED);
        assertEquals(new BigDecimal("5.00"), hourlyFee);

        BigDecimal dailyFee = lockerService.resolveLockerFee(locker, PassType.DAILY, LockerMode.PAID_MANAGED);
        assertEquals(new BigDecimal("20.00"), dailyFee);

        BigDecimal weeklyFee = lockerService.resolveLockerFee(locker, PassType.WEEKLY, LockerMode.PAID_MANAGED);
        assertEquals(new BigDecimal("80.00"), weeklyFee);

        BigDecimal monthlyFee = lockerService.resolveLockerFee(locker, PassType.MONTHLY, LockerMode.PAID_MANAGED);
        assertEquals(new BigDecimal("250.00"), monthlyFee);
    }
}
