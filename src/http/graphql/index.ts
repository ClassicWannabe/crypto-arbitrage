import { ApolloClient, InMemoryCache } from "@apollo/client";

export const getClient = (uri: string) => {
  return new ApolloClient({
    uri,
    cache: new InMemoryCache(),
  });
}
