import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminTickets,
  fetchAdminTicketDetail,
  updateTicket,
  addAdminMessage,
  fetchSupportStats,
  fetchCannedResponses,
  createCannedResponse,
  type AdminTicketListParams,
} from "@frontend/api/support.js";
import type {
  UpdateTicketInput,
  CreateTicketMessageInput,
  CreateCannedResponseInput,
} from "@opshield/shared";

export function useAdminTickets(params?: AdminTicketListParams) {
  return useQuery({
    queryKey: ["admin-support-tickets", params],
    queryFn: () => fetchAdminTickets(params),
  });
}

export function useAdminTicketDetail(ticketNumber: string) {
  return useQuery({
    queryKey: ["admin-support-ticket", ticketNumber],
    queryFn: () => fetchAdminTicketDetail(ticketNumber),
    enabled: !!ticketNumber,
  });
}

export function useUpdateTicket(ticketNumber: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateTicketInput) =>
      updateTicket(ticketNumber, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin-support-ticket", ticketNumber],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin-support-tickets"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["support-stats"],
      });
    },
  });
}

export function useAddAdminMessage(ticketNumber: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTicketMessageInput) =>
      addAdminMessage(ticketNumber, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin-support-ticket", ticketNumber],
      });
    },
  });
}

export function useSupportStats() {
  return useQuery({
    queryKey: ["support-stats"],
    queryFn: fetchSupportStats,
  });
}

export function useCannedResponses() {
  return useQuery({
    queryKey: ["canned-responses"],
    queryFn: fetchCannedResponses,
  });
}

export function useCreateCannedResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCannedResponseInput) =>
      createCannedResponse(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["canned-responses"],
      });
    },
  });
}
