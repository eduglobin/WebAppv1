---
id: overstay-rebooking
title: Institute Overstay & Rebooking
sidebar_position: 2
---

# Overstay & Rebooking Modules (70-74)

This section covers the flexible-slot library behavior for what happens when a student's session timer ends.

## Module 70: Overstay Detection
Overstay is a derived state (`status = 'IN_USE' AND valid_until < NOW()`). The background `OverstayDetectionJob` runs every minute to:
1. **Stage 1**: Alert the student the moment the session ends (`overstay_notified_at`).
2. **Stage 2**: Alert the library owner if the student hasn't left after a grace period.
3. **Stage 3**: Send escalating reminders to the student if the queue depth > 0.

## Module 71: Waiting Queue Heads-Up
When a seat enters OVERSTAY, the next student in the queue receives a heads-up: *"A seat should free up shortly \u2014 you're next"*. This is **not an offer**, avoiding early assignments to occupied seats.

## Module 72: Smart Rebooking
When a student wants to extend their time but their current seat is booked by someone else soon, `RebookService` provides ranked alternatives:
1. Move to a new seat for the entire window.
2. Stay on the current seat until the hard stop, then move.
3. Stay on the current seat until the hard stop (partial).
4. Join the queue.

Rebooking locks the new seat to ensure an atomic move via `LockService`.

## Module 73: Owner Vacancy Forecast
For walk-ins, `VacancyForecastService` maps the upcoming few hours to answer "when will seats free up". The system specifically suggests the **best-fit seat** (the seat whose free window most closely matches the walk-in duration) to avoid fragmenting large open blocks.

## Module 74: Overstay Fairness Penalty
Students who overstay without vacating have their recorded `overstay_minutes` penalized in the `FairShareQueueService`, pushing them down the priority queue. Owner-released seats do not apply a penalty to protect the student from arbitrary owner actions.
