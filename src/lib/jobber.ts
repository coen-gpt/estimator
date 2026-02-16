export const JOBBER_AUTHORIZE_URL = "https://api.getjobber.com/api/oauth/authorize";
export const JOBBER_TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
export const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";

export type JobberGraphQLError = {
  message: string;
  path?: string[];
  extensions?: Record<string, unknown>;
};

export type JobberGraphQLResponse<T> = {
  data?: T;
  errors?: JobberGraphQLError[];
};

export async function jobberGraphQL<TData, TVariables extends Record<string, unknown>>(
  accessToken: string,
  query: string,
  variables?: TVariables
): Promise<JobberGraphQLResponse<TData>> {
  const response = await fetch(JOBBER_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
    cache: "no-store"
  });

  const body = (await response.json()) as JobberGraphQLResponse<TData>;

  if (!response.ok) {
    return {
      errors: [
        {
          message: `GraphQL request failed with ${response.status}`,
          extensions: {
            status: response.status,
            response: body
          }
        }
      ]
    };
  }

  return body;
}

/*
Example query:
query AccountInfo {
  account {
    id
    name
  }
}

Example mutation skeleton for quote draft:
mutation CreateQuote($input: QuoteCreateInput!) {
  quoteCreate(input: $input) {
    quote {
      id
      quoteNumber
      status
    }
    userErrors {
      message
      path
    }
  }
}
*/
