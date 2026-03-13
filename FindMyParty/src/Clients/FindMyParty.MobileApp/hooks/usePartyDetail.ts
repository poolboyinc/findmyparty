import { useState, useCallback } from 'react';
import { partyService } from '../services/partyService';
import { bookingService } from '../services/bookingService';
import type { PartyDetail } from '../types/parties';

export function usePartyDetail() {
  const [party, setParty] = useState<PartyDetail | null>(null);
  const [ticketCount, setTicketCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const maxTickets = party ? Math.min(10, party.remainingCapacity) : 1;
  const totalPrice = (party?.price ?? 0) * ticketCount;
  const canBook = !loading && !bookingSuccess && party?.isSoldOut === false && maxTickets > 0;

  const load = useCallback(async (partyId: string) => {
    setLoading(true);
    setStatusMessage('');
    setBookingSuccess(false);
    setTicketCount(1);
    try {
      const data = await partyService.getPartyById(partyId);
      setParty(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const increment = useCallback(() => {
    setTicketCount(c => Math.min(c + 1, maxTickets));
  }, [maxTickets]);

  const decrement = useCallback(() => {
    setTicketCount(c => Math.max(c - 1, 1));
  }, []);

  const book = useCallback(async () => {
    if (!party) return;
    setLoading(true);
    setStatusMessage('');
    try {
      const success = await bookingService.createBooking(party.id, ticketCount);
      if (success) {
        setBookingSuccess(true);
        setStatusMessage(
          `You're in! ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} booked.`
        );
      } else {
        setStatusMessage('Booking failed. The party may be sold out.');
      }
    } catch {
      setStatusMessage('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [party, ticketCount]);

  return {
    party,
    ticketCount,
    totalPrice,
    maxTickets,
    canBook,
    loading,
    statusMessage,
    bookingSuccess,
    load,
    increment,
    decrement,
    book,
  };
}
