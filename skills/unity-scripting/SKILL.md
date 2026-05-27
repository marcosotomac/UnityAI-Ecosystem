# Unity C# Scripting Guide & Best Practices

This skill outlines guidelines and patterns for writing high-quality, performant, and maintainable C# scripts for Unity. When generating or editing Unity scripts, adhere to these rules strictly.

---

## 1. Code Style and Conventions

### Naming Conventions
- **Classes / Structs / Interfaces**: PascalCase (e.g., `PlayerController`, `IDamageable`).
- **Methods**: PascalCase (e.g., `TakeDamage`, `Initialize`).
- **Properties**: PascalCase (e.g., `CurrentHealth`, `IsDead`).
- **Public Fields**: PascalCase (avoid public fields when possible; use properties instead).
- **Private/Protected Fields**: camelCase prefixed with an underscore (e.g., `_health`, `_rb`).
- **Local Variables / Parameters**: camelCase (e.g., `damageAmount`, `speedMultiplier`).

### Serialization & Access Modifiers
- Do not expose variables as `public` just to show them in the Inspector. Keep encapsulation clean.
- Use `[SerializeField] private` to expose private variables to the Unity Editor Inspector.
- Mark fields that should be editable but read-only at runtime with `[Tooltip("...")]` to provide guidance in the Editor.

```csharp
// GOOD
[Header("Movement Settings")]
[SerializeField] private float _moveSpeed = 5.0f;
[SerializeField] private float _jumpForce = 7.0f;

public float MoveSpeed => _moveSpeed; // Public read-only property
```

---

## 2. Component Caching & Performance

### Avoid Costly Calls in Loops
- **Never** call `GetComponent()`, `Find()`, `FindWithTag()`, or `FindObjectOfType()` inside `Update()`, `LateUpdate()`, `FixedUpdate()`, or loops.
- Cache references in `Awake()` or `Start()`.

```csharp
// BAD
void Update() {
    Rigidbody rb = GetComponent<Rigidbody>();
    rb.AddForce(Vector3.up);
}

// GOOD
private Rigidbody _rb;

void Awake() {
    _rb = GetComponent<Rigidbody>();
}

void FixedUpdate() {
    _rb.AddForce(Vector3.up * 10f);
}
```

### String Comparisons
- Do not compare tags using `.tag == "Player"`. This allocates memory.
- Use `CompareTag("Player")` which is optimized and doesn't allocate GC garbage.

---

## 3. Physics & Lifecycle Methods

- **Physics operations**: Always perform Rigidbody manipulations, forces, and movements inside `FixedUpdate()` rather than `Update()`.
- **Frame-rate independent movement**: Always multiply non-physics translations by `Time.deltaTime` in `Update()`, and physics forces by `Time.fixedDeltaTime` in `FixedUpdate()` (though Unity forces applied inside `FixedUpdate` automatically account for fixed delta time, manual multiplications should be precise).

---

## 4. Modern Architecture & Decoupling

- **ScriptableObjects**: Use ScriptableObjects for data storage, item databases, configurations, and game events.
- **Events**: Use standard C# events `Action` or `Action<T>` (from `System`) or `UnityEngine.Events` to notify other systems about state changes, avoiding tight coupling between classes.
- **Namespaces**: Always organize your scripts into logical namespaces (e.g., `Game.Player`, `Game.UI`, `Game.Combat`).

---

## 5. Typical Script Template

Use this blueprint when creating a new MonoBehaviour class:

```csharp
using System;
using UnityEngine;

namespace Game.Core
{
    [RequireComponent(typeof(Rigidbody))]
    public class EntityController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform _visualsTransform;
        
        [Header("Parameters")]
        [SerializeField] private float _speed = 5f;

        private Rigidbody _rb;

        // Triggered when script instance is loaded
        private void Awake()
        {
            _rb = GetComponent<Rigidbody>();
        }

        // Triggered before the first frame update
        private void Start()
        {
            if (_visualsTransform == null)
            {
                Debug.LogWarning($"[EntityController] Visuals Transform is unassigned on {gameObject.name}");
            }
        }

        // Update is called once per frame
        private void Update()
        {
            HandleInput();
        }

        // FixedUpdate is called at fixed physics intervals
        private void FixedUpdate()
        {
            MoveEntity();
        }

        private void HandleInput()
        {
            // Input logic
        }

        private void MoveEntity()
        {
            // Physics movement logic
        }
    }
}
```
