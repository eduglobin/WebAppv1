import React, { useCallback, useEffect, useRef, useState } from 'react';

export type SeatStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'IN_USE' | 'MAINTENANCE';

export interface Seat {
  id: string;
  seatCode: string;
  row_idx: number;
  col_idx: number;
  status: SeatStatus;
  is_girls_only?: boolean;
  has_power_socket?: boolean;
}

export interface Locker {
  id: string;
  lockerCode: string;
  status: SeatStatus;
  price_hourly?: number;
  price_daily?: number;
  price_weekly?: number;
  price_monthly?: number;
}

interface SeatCellProps {
  seat: Seat;
  isMySelection: boolean;
  onSelect: (seat: Seat) => void;
}

const STATUS_STYLES: Record<SeatStatus, string> = {
  AVAILABLE:
    'border-emerald-500 text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-400 hover:scale-105 cursor-pointer active:scale-95',
  LOCKED:
    'border-amber-400 text-amber-300 animate-pulse cursor-not-allowed opacity-80',
  BOOKED:
    'border-blue-400 bg-blue-500/10 text-blue-300 cursor-not-allowed',
  IN_USE:
    'border-red-500 bg-red-500/15 text-red-300 cursor-not-allowed',
  MAINTENANCE:
    'border-slate-700 bg-slate-800/60 text-slate-600 cursor-not-allowed',
};

const MY_SELECTION_STYLE =
  'border-indigo-400 bg-indigo-500/20 text-indigo-200 ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900 cursor-pointer scale-105';

function SeatCell({ seat, isMySelection, onSelect }: SeatCellProps) {
  const isDisabled = seat.status !== 'AVAILABLE' && !isMySelection;
  const style = isMySelection ? MY_SELECTION_STYLE : STATUS_STYLES[seat.status];

  return (
    <button
      id={`seat-${seat.id}`}
      disabled={isDisabled}
      onClick={() => !isDisabled && onSelect(seat)}
      title={seat.seatCode + (seat.is_girls_only ? ' · Girls Only' : '') + (seat.has_power_socket ? ' · Power Socket' : '')}
      className={`relative rounded-lg border-2 px-2 py-2 font-mono text-xs font-bold transition-all duration-200 min-w-[3.5rem] ${style}`}
    >
      <span>{seat.seatCode}</span>
      {seat.has_power_socket && (
        <span className="absolute -top-1 -right-1 text-[10px] leading-none">⚡</span>
      )}
      {seat.is_girls_only && (
        <span className="absolute -bottom-1 -right-1 text-[10px] leading-none">♀</span>
      )}
    </button>
  );
}

interface LockerCardProps {
  locker: Locker;
  isMySelection: boolean;
  passType: PassType;
  onSelect: (locker: Locker) => void;
}

export type PassType = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

function LockerCard({ locker, isMySelection, passType, onSelect }: LockerCardProps) {
  const isDisabled = locker.status !== 'AVAILABLE' && !isMySelection;
  const price = getLockerPrice(locker, passType);
  const style = isMySelection ? MY_SELECTION_STYLE : STATUS_STYLES[locker.status];

  return (
    <button
      id={`locker-${locker.id}`}
      disabled={isDisabled}
      onClick={() => !isDisabled && onSelect(locker)}
      className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-3 py-2 font-mono text-xs font-bold transition-all duration-200 min-w-[4rem] ${style}`}
    >
      <span>🔒</span>
      <span>{locker.lockerCode}</span>
      {price !== null && (
        <span className="text-[10px] font-normal opacity-75">₹{price}</span>
      )}
    </button>
  );
}

function getLockerPrice(locker: Locker, passType: PassType): number | null {
  switch (passType) {
    case 'HOURLY': return locker.price_hourly ?? null;
    case 'DAILY':  return locker.price_daily ?? null;
    case 'WEEKLY': return locker.price_weekly ?? null;
    case 'MONTHLY': return locker.price_monthly ?? null;
  }
}

// ─── Legend ──────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { status: 'AVAILABLE' as SeatStatus, label: 'Available', color: 'bg-emerald-500' },
  { status: 'LOCKED' as SeatStatus,    label: 'Being Booked', color: 'bg-amber-400 animate-pulse' },
  { status: 'BOOKED' as SeatStatus,    label: 'Booked', color: 'bg-blue-400' },
  { status: 'IN_USE' as SeatStatus,    label: 'In Use', color: 'bg-red-500' },
  { status: 'MAINTENANCE' as SeatStatus, label: 'Maintenance', color: 'bg-slate-600' },
];

// ─── Main SeatGrid ────────────────────────────────────────────────────────────

export interface SeatGridProps {
  seats: Seat[];
  lockers: Locker[];
  lockerMode: 'NO_LOCKERS' | 'FREE_LOCKERS' | 'PAID_MANAGED';
  selectedSeat: Seat | null;
  selectedLocker: Locker | null;
  passType: PassType;
  onSeatSelect: (seat: Seat) => void;
  onLockerSelect: (locker: Locker | null) => void;
  /** Called when a live WebSocket or poll update arrives */
  onStatusUpdate?: (resourceType: 'SEAT' | 'LOCKER', resourceId: string, status: SeatStatus) => void;
}

export function SeatGrid({
  seats,
  lockers,
  lockerMode,
  selectedSeat,
  selectedLocker,
  passType,
  onSeatSelect,
  onLockerSelect,
}: SeatGridProps) {
  // Group seats into rows for grid rendering
  const rows: Record<number, Seat[]> = {};
  for (const seat of seats) {
    if (!rows[seat.row_idx]) rows[seat.row_idx] = [];
    rows[seat.row_idx].push(seat);
  }
  const sortedRows = Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b);

  const showLockers = lockerMode !== 'NO_LOCKERS' && lockers.length > 0;

  const stats = {
    available: seats.filter((s) => s.status === 'AVAILABLE').length,
    total: seats.length,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          <span className="text-emerald-400 font-bold">{stats.available}</span>
          <span> of {stats.total} seats available</span>
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.status} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Seat Grid */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 overflow-x-auto">
        <div className="flex flex-col gap-2 min-w-max mx-auto">
          {/* Aisle label */}
          <div className="text-center mb-1">
            <span className="text-slate-600 text-xs uppercase tracking-widest">— Front —</span>
          </div>

          {sortedRows.map((rowIdx) => (
            <div key={rowIdx} className="flex gap-2 items-center">
              <span className="text-slate-700 text-xs w-5 text-right shrink-0 font-mono">{rowIdx}</span>
              <div className="flex gap-2 flex-wrap">
                {rows[rowIdx]
                  .sort((a, b) => a.col_idx - b.col_idx)
                  .map((seat) => (
                    <SeatCell
                      key={seat.id}
                      seat={seat}
                      isMySelection={selectedSeat?.id === seat.id}
                      onSelect={onSeatSelect}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Locker Row */}
      {showLockers && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-200">Lockers</h4>
              <p className="text-xs text-slate-500">
                {lockerMode === 'FREE_LOCKERS'
                  ? 'Complimentary with your seat booking'
                  : 'Add a locker to your booking (optional)'}
              </p>
            </div>
            {selectedLocker && (
              <button
                onClick={() => onLockerSelect(null)}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                Remove locker ✕
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {lockers.map((locker) => (
              <LockerCard
                key={locker.id}
                locker={locker}
                isMySelection={selectedLocker?.id === locker.id}
                passType={passType}
                onSelect={(l) => onLockerSelect(selectedLocker?.id === l.id ? null : l)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
