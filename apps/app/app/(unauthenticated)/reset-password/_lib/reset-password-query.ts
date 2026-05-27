export type ResetPasswordQuery = {
  error: string;
  token: string;
};

type ResetPasswordSearchParams = {
  error?: string | string[];
  token?: string | string[];
};

function getFirstQueryValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function getResetPasswordQuery(searchParams: ResetPasswordSearchParams): ResetPasswordQuery {
  return {
    error: getFirstQueryValue(searchParams.error),
    token: getFirstQueryValue(searchParams.token),
  };
}

export function hasInvalidResetPasswordToken({ error, token }: ResetPasswordQuery) {
  return !token || error.toUpperCase() === "INVALID_TOKEN";
}
