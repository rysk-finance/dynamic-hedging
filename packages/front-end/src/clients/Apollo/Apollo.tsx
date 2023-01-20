import type { PropsWithChildren } from "react";

import {
  ApolloClient,
  ApolloLink,
  ApolloProvider as Provider,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";

const ApolloProvider = ({ children }: PropsWithChildren<unknown>) => {
  const ryskSubgraph = new HttpLink({
    uri: process.env.REACT_APP_SUBGRAPH_URL,
  });

  const opynSubgraph = new HttpLink({
    uri: process.env.REACT_APP_OPYN_SUBGRAPH_URL,
  });

  const client = new ApolloClient({
    link: ApolloLink.split(
      (operation) => operation.getContext().clientName === "opyn",
      opynSubgraph,
      ryskSubgraph
    ),
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

  return <Provider client={client}>{children}</Provider>;
};

export default ApolloProvider;
