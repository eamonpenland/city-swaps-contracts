
;; proposal
;; <add a description here>
(use-trait sip-010-token .sip-010-trait-ft-standard.sip-010-trait)
;; (use-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

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
(define-constant ERR_EXTERNAL_ID_ALREADY_USED u1007)
(define-constant FUNDING_LENGTH u2100)
(define-constant ERR_FUNDING_EXPIRED_FOR_PROPOSAL u1008)
(define-constant ERR_INSUFFICIENT_FUNDING_AMOUNT u1009)

;; data maps and vars
;;

(define-data-var feeRate uint u1)
(define-data-var next-proposal-id uint u0)


(define-map ProposalIds
  uint  ;; external-id
  uint  ;; proposal-id  
)

(define-map Proposals
  uint ;; proposal-id
  {
    poster: principal,
    category: (string-ascii 32),
    token: principal,
    funded-amount: uint,
    hash: (buff 64),
    active: bool,
    external-id: uint,
    stacks-height: uint
  }
)

(define-map CityCoins
  principal ;; token
  {
    name: (string-ascii 32),
    symbol: (string-ascii 32),
  }
)

(define-read-only (get-fee-rate)
  (var-get feeRate)
)

(define-read-only (get-proposal-count)
  (var-get next-proposal-id)
)

(define-read-only (get-proposal (proposal-id uint))
  (map-get? Proposals proposal-id)
)

(define-read-only (get-proposal-by-external-id (external-id uint))
  (ok (get-proposal (unwrap! (map-get? ProposalIds external-id) (err ERR_PROPOSAL_NOT_FOUND))))
)

(define-read-only (get-coin-or-err (token <sip-010-token>))
  (ok (unwrap! (map-get? CityCoins (contract-of token)) (err u1)))
)

;; private functions
;;


(define-private (get-fee (amount uint))
  (/ (* (var-get feeRate) amount) u100)
)

;; public functions
;;

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
    (external-id uint)
)
  (let
    (
      (next-id (+ (var-get next-proposal-id) u1))
    )
    (begin 
      (asserts! (is-none (map-get? ProposalIds external-id)) (err ERR_EXTERNAL_ID_ALREADY_USED))
      (asserts! (is-ok (get-coin-or-err token)) (err ERR_COIN_NOT_SUPPORTED))
      (map-set Proposals next-id {
        poster: tx-sender, 
        category: category, 
        token: (contract-of token), 
        funded-amount: u0,
        hash: hash,
        active: true,
        external-id: external-id,
        stacks-height: block-height
      })
      (map-set ProposalIds external-id next-id)
      (ok (var-set next-proposal-id next-id))
    )
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
        (txFee (get-fee amount))
        (txAmount (- amount txFee))
      )
      (asserts! (>= amount u100) (err ERR_INSUFFICIENT_FUNDING_AMOUNT))
      (asserts! (<= (- block-height (get stacks-height proposal)) FUNDING_LENGTH) (err ERR_FUNDING_EXPIRED_FOR_PROPOSAL))
      (asserts! (is-eq (get active proposal) true) (err ERR_INACTIVE_PROPOSAL))
      (asserts! (is-ok (get-coin-or-err token)) (err ERR_COIN_NOT_SUPPORTED))
      (asserts! (is-eq (get token proposal) (contract-of token)) (err ERR_INCORRECT_FUNDING_SOURCE))
      (asserts! (is-ok (contract-call? token transfer txAmount tx-sender recipient none)) (err ERR_INSUFFICIENT_FUNDS))
      (asserts! (is-ok (contract-call? token transfer txFee tx-sender CONTRACT_ADDRESS none)) (err ERR_FEE_TRANSFER_FAILED))
      (ok (map-set Proposals proposal-id (
        merge proposal {
            funded-amount: (+ (get funded-amount proposal) txAmount)
        }
      )))
  )
)

(define-public (withdrawl-fees (token <sip-010-token>) (recipient principal) (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
    (asserts! (is-ok (as-contract (contract-call? token transfer amount CONTRACT_ADDRESS recipient none))) (err ERR_INSUFFICIENT_FUNDS))
    (ok true)
  )
)