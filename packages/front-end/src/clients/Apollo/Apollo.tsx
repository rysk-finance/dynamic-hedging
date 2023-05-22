import type { PropsWithChildren } from "react";

import {
  ApolloClient,
  ApolloLink,
  ApolloProvider as Provider,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";

const ryskSubgraph = new HttpLink({
  uri: process.env.REACT_APP_SUBGRAPH_URL,
});

export const RyskApolloClient = new ApolloClient({
  link: ryskSubgraph,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          writeOptionsActions: {
            keyArgs: false,
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
          buybackOptionActions: {
            keyArgs: false,
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
          rebalanceDeltaActions: {
            keyArgs: false,
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  }),
});

const ApolloProvider = ({ children }: PropsWithChildren<unknown>) => {
  return <Provider client={RyskApolloClient}>{children}</Provider>;
};

export default ApolloProvider;
