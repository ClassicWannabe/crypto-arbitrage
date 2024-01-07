import { CoinPair, TriangularCoinPair } from "../../types.js";

export class TriangularPairCalculator {
  private readonly minProfitPercentage: number;
  
  constructor(minProfitPercentage: number) {
    if (minProfitPercentage < 0) {
      throw new Error("Cannot set minProfitPercentage to less than 0");
    }
    this.minProfitPercentage = minProfitPercentage;
  }

  calculate(pairs: CoinPair[]) {
    for (const pair of pairs) {
    }
  }

  private getTriangularPairs(pairs: CoinPair[]): TriangularCoinPair[] {
    for (const firstPair of pairs) {
      for (const secondPair of pairs) {
        for (const thirdPair of pairs) {
          const triangularPair: TriangularCoinPair = {
            firstPair,
            secondPair,
            thirdPair,
          };
          if (this.isUniqueTriangularPair(triangularPair)) {
          }
        }
      }
    }

    return [];
  }

  private isUniqueTriangularPair(triangularPair: TriangularCoinPair): boolean {
    const { firstPair, secondPair, thirdPair } = triangularPair;
    return (
      this.isUniquePairCombination(firstPair, secondPair) &&
      this.isUniquePairCombination(firstPair, thirdPair) &&
      this.isUniquePairCombination(secondPair, thirdPair)
    );
  }

  private isUniquePairCombination(
    pairOne: CoinPair,
    pairTwo: CoinPair
  ): boolean {
    if (
      pairOne.baseCoin === pairTwo.baseCoin &&
      pairOne.quoteCoin === pairTwo.quoteCoin
    ) {
      return false;
    }
    if (
      pairOne.baseCoin === pairTwo.quoteCoin &&
      pairOne.quoteCoin === pairTwo.baseCoin
    ) {
      return false;
    }
    return true;
  }

  private isFeasibleTriangularPair(
    triangularPair: TriangularCoinPair
  ): boolean {
    const { firstPair, secondPair, thirdPair } = triangularPair;
    return (
      this.isUniquePairCombination(firstPair, secondPair) &&
      this.isUniquePairCombination(firstPair, thirdPair) &&
      this.isUniquePairCombination(secondPair, thirdPair)
    );
  }
}
