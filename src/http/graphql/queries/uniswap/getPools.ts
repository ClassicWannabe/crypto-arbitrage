import { gql } from "@apollo/client";

export const getPools = gql`
{
    query GetPools ($limit: Int, $offset: Int) {
        pools(orderBy: totalValueLockedETH, orderDirection: desc, first: $limit, skip: $offset) {
            id
            totalValueLockedETH
            token0Price
            token1Price
            feeTier
            token0 {id symbol name decimals}
            token1 {id symbol name decimals}
        }
      }
}
`