import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface UseApiMutationOptions<TData, TVariables> {
  successMessage?: string;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

/**
 * Wrapper around useMutation that automatically shows toast notifications.
 * - Success: shows green toast with custom message
 * - Error: handled globally by http.ts interceptor
 */
export function useApiMutation<TData = unknown, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseApiMutationOptions<TData, TVariables>
): UseMutationResult<TData, Error, TVariables> {
  const { successMessage, onSuccess, onError } = options || {};

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      if (successMessage) toast.success(successMessage);
      onSuccess?.(data);
    },
    onError: (error) => {
      // Error toast handled globally by http.ts
      onError?.(error);
    },
  });
}

export default useApiMutation;
