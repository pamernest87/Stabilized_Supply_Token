;; Stabilized Supply Token (SST) Contract
;; A token with stabilization mechanisms for supply control

;; Define token properties
(define-fungible-token sst)

;; Define data variables
(define-data-var token-name (string-ascii 32) "Stabilized Supply Token")
(define-data-var token-symbol (string-ascii 10) "SST")
(define-data-var token-decimals uint u6)
(define-data-var token-supply uint u0)
(define-data-var price-target uint u100000000) ;; $1.00 in micro-cents (10^8)
(define-data-var price-tolerance-pct uint u5) ;; 5% tolerance band
(define-data-var expansion-rate uint u5) ;; 5% expansion rate
(define-data-var contraction-rate uint u5) ;; 5% contraction rate
(define-data-var oracle-price uint u100000000) ;; Initial price = $1.00
(define-data-var treasury-address principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM) ;; Treasury for holding backing assets
(define-data-var current-epoch uint u0) ;; Track the current epoch

;; Define maps
(define-map allowances {owner: principal, spender: principal} uint)
(define-map stabilization-history 
  {epoch: uint} 
  {price: uint, action: (string-ascii 20), amount: uint})

;; Constants
(define-constant ERR-NOT-AUTHORIZED u1)
(define-constant ERR-INSUFFICIENT-BALANCE u2)
(define-constant ERR-INSUFFICIENT-ALLOWANCE u3)
(define-constant ERR-STABILIZATION-FAILED u4)
(define-constant ERR-INVALID-AMOUNT u5)
(define-constant ERR-ORACLE-UPDATE-FAILED u6)

;; Utility functions
(define-read-only (get-name)
  (var-get token-name))

(define-read-only (get-symbol)
  (var-get token-symbol))

(define-read-only (get-decimals)
  (var-get token-decimals))

(define-read-only (get-total-supply)
  (var-get token-supply))

(define-read-only (get-balance (account principal))
  (ft-get-balance sst account))

(define-read-only (get-allowance (owner principal) (spender principal))
  (default-to u0 (map-get? allowances {owner: owner, spender: spender})))

(define-read-only (get-current-price)
  (var-get oracle-price))

(define-read-only (get-price-target)
  (var-get price-target))

(define-read-only (get-tolerance-band)
  (var-get price-tolerance-pct))

;; Get the current epoch
(define-read-only (get-current-epoch)
  (var-get current-epoch))

;; Function to increment the epoch counter
(define-private (increment-epoch)
  (var-set current-epoch (+ (var-get current-epoch) u1)))

;; Calculate if price is within the stability range
(define-read-only (is-price-stable)
  (let (
    (current-price (var-get oracle-price))
    (target (var-get price-target))
    (tolerance (var-get price-tolerance-pct))
    (upper-bound (+ target (/ (* target tolerance) u100)))
    (lower-bound (- target (/ (* target tolerance) u100)))
  )
  (and (>= current-price lower-bound) (<= current-price upper-bound))))

;; Token transfer functions
(define-public (transfer (amount uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) (err ERR-NOT-AUTHORIZED))
    (ft-transfer? sst amount sender recipient)))

(define-public (transfer-from (amount uint) (sender principal) (recipient principal))
  (let ((allowance (get-allowance sender tx-sender)))
    (begin
      (asserts! (<= amount allowance) (err ERR-INSUFFICIENT-ALLOWANCE))
      (map-set allowances 
        {owner: sender, spender: tx-sender} 
        (- allowance amount))
      (ft-transfer? sst amount sender recipient))))

(define-public (approve (spender principal) (amount uint))
  (begin
    (map-set allowances {owner: tx-sender, spender: spender} amount)
    (ok true)))

;; Admin functions - Would normally have proper authorization checks
(define-public (set-oracle-price (new-price uint))
  (begin
    ;; In production, this would verify the caller is an authorized oracle
    (var-set oracle-price new-price)
    (try! (run-stabilization-check))
    (ok true)))

;; Stabilization mechanism
(define-public (run-stabilization-check)
  (let (
    (current-price (var-get oracle-price))
    (target (var-get price-target))
    (tolerance (var-get price-tolerance-pct))
    (upper-bound (+ target (/ (* target tolerance) u100)))
    (lower-bound (- target (/ (* target tolerance) u100)))
    (epoch-number (+ (var-get current-epoch) u1))
  )
  (if (> current-price upper-bound)
    ;; Price is too high - contract needs to expand supply
    (expand-supply epoch-number)
    (if (< current-price lower-bound)
      ;; Price is too low - contract needs to contract supply
      (contract-supply epoch-number)
      ;; Price is within bounds - no action needed
      (ok true)))))

;; Supply expansion - mint new tokens to treasury
(define-private (expand-supply (epoch uint))
  (let (
    (current-supply (var-get token-supply))
    (expansion-amount (/ (* current-supply (var-get expansion-rate)) u100))
    (treasury (var-get treasury-address))
  )
  (begin
    (var-set token-supply (+ current-supply expansion-amount))
    (try! (ft-mint? sst expansion-amount treasury))
    (map-set stabilization-history
      {epoch: epoch}
      {price: (var-get oracle-price), action: "expansion", amount: expansion-amount})
    (increment-epoch)
    (ok true))))

;; Supply contraction - burn tokens from treasury
(define-private (contract-supply (epoch uint))
  (let (
    (current-supply (var-get token-supply))
    (contraction-amount (/ (* current-supply (var-get contraction-rate)) u100))
    (treasury (var-get treasury-address))
    (treasury-balance (ft-get-balance sst treasury))
  )
  (begin
    ;; Can only contract up to what's in the treasury
    (asserts! (<= contraction-amount treasury-balance) (err ERR-STABILIZATION-FAILED))
    (var-set token-supply (- current-supply contraction-amount))
    (try! (ft-burn? sst contraction-amount treasury))
    (map-set stabilization-history
      {epoch: epoch}
      {price: (var-get oracle-price), action: "contraction", amount: contraction-amount})
    (increment-epoch)
    (ok true))))

;; Get stabilization history for a specific epoch
(define-read-only (get-epoch-history (epoch uint))
  (map-get? stabilization-history {epoch: epoch}))

;; Initialize the token
(define-public (initialize (initial-supply uint) (admin principal))
  (begin
    (asserts! (is-eq (var-get token-supply) u0) (err ERR-NOT-AUTHORIZED))
    (var-set token-supply initial-supply)
    (ft-mint? sst initial-supply admin)))