
;; proposal
;; <add a description here>
(use-trait sip-010-token .sip-010-trait-ft-standard.sip-010-trait)

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))
(define-constant ERR_UNAUTHORIZED u401)
(define-constant ERR_PROPOSAL_NOT_FOUND u1000)
(define-constant ERR_INVALID_VALUE u1001)
(define-constant ERR_INSUFFICIENT_FUNDS u1002)
(define-constant ERR_FEE_TRANSFER_FAILED u1003)
(define-constant ERR_COIN_NOT_SUPPORTED u1004)
(define-constant ERR_INCORRECT_FUNDING_SOURCE u1005)
(define-constant ERR_INACTIVE_PROPOSAL u1006)
(define-constant MAX_FEE_RATE u10)

;; data maps and vars
;;

(define-map Proposals
  uint ;; proposal-id
  {
    poster: principal,
    category: (string-ascii 32),
    token: principal,
    funded_amount: uint,
    hash: (buff 64),
    active: bool,
  }
)

(define-map TreasuryAmounts
  principal ;; token
  {
    amount: uint,
  }
)

(define-map CityCoins
  principal ;; token
  {
    name: (string-ascii 32),
    symbol: (string-ascii 32),
  }
)

(define-map FundingStatsAtBlock
  {
    stacksHeight: uint,
    city: principal,
  }
  uint ;; amount
)

(define-map CategoryStatsAtBlock
  {
    stacksHeight: uint,
    city: principal,
    category: (string-ascii 32),
  }
  uint ;; amount
)

(define-data-var feeRate uint u0) ;; defined in bp (base points)
(define-data-var last-proposal-id uint u0)

(define-read-only (get-fee-rate)
  (var-get feeRate)
)

(define-read-only (get-fee (amount uint))
  (if (is-eq (var-get feeRate) u0)
    u0
    (* amount (var-get feeRate))
  )
)


(define-read-only (get-proposal-count)
  (var-get last-proposal-id)
)

(define-read-only (get-proposal (proposalId uint))
  (map-get? Proposals proposalId)
)


(define-read-only (get-coin-or-err (token <sip-010-token>))
  (let (
    (city (unwrap! (map-get? CityCoins (contract-of token)) (err u1)))
  )
    (ok city)
  )
)


;; private functions
;;

;; (define-private (update-treasury (token <sip-010-token>) (amount uint))
;;   (asserts! (is-ok ()) (err TRANSFER_FAILED))
;; )

;; public functions
;;

(define-public (set-fee-rate (newFeeRate uint))
  (begin
    (asserts! (<= newFeeRate MAX_FEE_RATE) (err ERR_INVALID_VALUE))
    (asserts! (is-eq tx-sender CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
    (var-set feeRate newFeeRate)
    (ok true)
  )
)

(define-public (set-token (token <sip-010-token>))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
    (let (
      (name (try! (contract-call? token get-name)))
      (symbol (try! (contract-call? token get-symbol)))
    )
      (ok (map-set CityCoins (contract-of token) {
        name: name,
        symbol: symbol,
      }))
    )
  )
)

(define-public (create
    (token <sip-010-token>)
    (hash (buff 64)) 
    (category (string-ascii 32)) 
)
  (begin
    (asserts! (is-ok (get-coin-or-err token)) (err ERR_COIN_NOT_SUPPORTED))
    (map-set Proposals (var-get last-proposal-id) {
      poster: tx-sender, 
      category: category, 
      token: (contract-of token), 
      funded_amount: u0,
      hash: hash,
      active: true
    })
    (ok (var-set last-proposal-id (+ (var-get last-proposal-id) u1)))
  )
)


(define-public (edit 
    (proposal-id uint) 
    (new-hash (buff 64))
)
  (let
    (
      (proposal (unwrap! (get-proposal proposal-id) (err ERR_PROPOSAL_NOT_FOUND)))
    )
    (asserts! (is-eq tx-sender (get poster proposal)) (err ERR_UNAUTHORIZED))
    (ok (map-set Proposals proposal-id (
      merge proposal {
          hash: new-hash
      }
    )))
  )
)

(define-public (toggle-active 
    (proposal-id uint) 
)
  (let
    (
      (proposal (unwrap! (get-proposal proposal-id) (err ERR_PROPOSAL_NOT_FOUND)))
      (active (unwrap-panic (if (get active proposal) (ok false) (ok true))))
    )
    (asserts! (is-eq tx-sender (get poster proposal)) (err ERR_UNAUTHORIZED))
    (ok (map-set Proposals proposal-id (
      merge proposal {
          active: active
      }
    )))
  )
)

;; Fund a proposal with a city coin and update proposal and stats
(define-public (fund
    (token <sip-010-token>)
    (proposal-id uint)
    (amount uint) 
)
  (let
      (
        (proposal (unwrap! (get-proposal proposal-id) (err ERR_PROPOSAL_NOT_FOUND)))
        (recipient (get poster proposal))
        (txFee (/ (get-fee amount) amount))
        (txAmount (- amount txFee))
      )
      (asserts! (is-eq (get active proposal) true) (err ERR_INACTIVE_PROPOSAL))
      (asserts! (is-ok (get-coin-or-err token)) (err ERR_COIN_NOT_SUPPORTED))
      (asserts! (is-eq (get token proposal) (contract-of token)) (err ERR_INCORRECT_FUNDING_SOURCE))
      (asserts! (is-ok (contract-call? token transfer txAmount tx-sender recipient none)) (err ERR_INSUFFICIENT_FUNDS))
      (asserts! (is-ok (contract-call? token transfer txFee tx-sender CONTRACT_ADDRESS none)) (err ERR_FEE_TRANSFER_FAILED))
      (asserts! (is-ok (update-stats proposal-id txAmount)) (err u1))
      (ok (map-set Proposals proposal-id (
        merge proposal {
            funded_amount: (+ (get funded_amount proposal) txAmount)
        }
      )))
  )
)

(define-private (update-stats (proposal-id uint) (txAmount uint))
  (let (
    (proposal (unwrap! (get-proposal proposal-id) (err ERR_PROPOSAL_NOT_FOUND)))
    (token (as-contract (get token proposal)))
    (category (get category proposal))
    (fundingStatsAtBlock (get-funding-stats-at-block-or-default token block-height))
    (categoryStatsAtBlock (get-category-stats-at-block-or-default token block-height category))
  )
    (begin 
      (map-set FundingStatsAtBlock {stacksHeight: block-height, city: token}
        (+ fundingStatsAtBlock txAmount)
      )
      (map-set CategoryStatsAtBlock {stacksHeight: block-height, city: token, category: category} 
        (+ categoryStatsAtBlock txAmount)
      )
      (ok true)
    )
  )
)

(define-public (withdraw-fees)
  (as-contract (stx-transfer? (stx-get-balance CONTRACT_ADDRESS) CONTRACT_ADDRESS CONTRACT_OWNER))
)

(define-read-only (get-funding-stats-at-block-or-default (city principal) (stacksHeight uint))
  (default-to  u0
    (map-get? FundingStatsAtBlock {stacksHeight: stacksHeight, city: city})
  )
)

(define-read-only (get-category-stats-at-block-or-default (city principal) (stacksHeight uint) (category (string-ascii 32)))
  (default-to  u0
    (map-get? CategoryStatsAtBlock {stacksHeight: stacksHeight, city: city, category: category})
  )
)

(define-public (initialize-contract)
  (set-fee-rate u1)
)

(initialize-contract)

