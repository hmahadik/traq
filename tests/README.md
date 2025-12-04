# Activity Tracker Test Suite

This directory contains a comprehensive test suite for the Activity Tracker project, built using pytest with proper test isolation and coverage reporting.

## Test Structure

### Test Files

- **`conftest.py`** - Shared test fixtures and configuration
- **`test_capture.py`** - Tests for screenshot capture functionality
- **`test_storage.py`** - Tests for database CRUD operations
- **`test_dhash.py`** - Tests specifically for dhash algorithm and comparison logic
- **`test_integration.py`** - Integration tests across multiple components

### Test Categories

The tests are organized by markers for easy filtering:

- `unit` - Unit tests for individual components
- `integration` - Integration tests across components
- `capture` - Tests related to screen capture functionality
- `storage` - Tests related to database storage
- `dhash` - Tests related to perceptual hashing

## Test Coverage

### Capture Functionality (`test_capture.py`)
- ✅ Screenshot capture with mocked MSS
- ✅ Directory structure creation (YYYY/MM/DD)
- ✅ Auto-generated and custom filenames
- ✅ Error handling (display connection, OS errors)
- ✅ dhash generation and consistency
- ✅ Hash comparison and similarity detection
- ✅ Edge cases and different hash sizes

### Storage Operations (`test_storage.py`)
- ✅ Database initialization and table creation
- ✅ Screenshot saving with metadata
- ✅ Timestamp handling from file modification time
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Time-range filtering
- ✅ Database persistence across instances
- ✅ Concurrent access safety
- ✅ SQL injection protection

### dhash Algorithm (`test_dhash.py`)
- ✅ Hash generation for various image patterns
- ✅ Hamming distance calculation
- ✅ Similarity threshold behavior
- ✅ Rotation and scale sensitivity
- ✅ Noise resistance testing
- ✅ Edge cases and boundary conditions
- ✅ Bit precision verification

### Integration Tests (`test_integration.py`)
- ✅ End-to-end capture and storage workflow
- ✅ Multiple screenshot similarity detection
- ✅ Time-based retrieval scenarios
- ✅ Realistic desktop pattern recognition
- ✅ Error handling across components
- ✅ Concurrent operation safety

## Test Fixtures

### Shared Fixtures (from `conftest.py`)

- **`temp_dir`** - Temporary directory for test data
- **`test_db_path`** - Temporary database path
- **`sample_image`** - Pre-created test image with pattern
- **`sample_image_similar`** - Similar image for dhash testing
- **`sample_image_different`** - Completely different image
- **`mock_mss`** - Mocked MSS screenshot functionality
- **`populated_storage`** - Pre-populated database for testing

## Running Tests

### Basic Usage

```bash
# Run all tests
pytest tests/

# Run specific test file
pytest tests/test_capture.py

# Run tests by category
pytest -m unit
pytest -m integration
pytest -m capture

# Run with coverage
pytest --cov=tracker --cov-report=html

# Verbose output
pytest -v
```

### Using the Test Runner

```bash
# Run comprehensive test suite
python run_tests.py
```

### Test Configuration

The test suite is configured via `pytest.ini` with:
- Coverage requirements (85% minimum)
- HTML coverage reports
- Strict marker enforcement
- Warning filters

## Test Isolation

All tests use proper isolation techniques:
- **Temporary directories** (`tmp_path` fixture) for file operations
- **Temporary databases** for storage testing
- **Mocked external dependencies** (MSS, display server)
- **Independent test data** that doesn't affect other tests

## Edge Cases Covered

### Capture Module
- Display server connection failures
- Invalid file paths
- Different image sizes and patterns
- Hash collision scenarios
- Memory constraints

### Storage Module  
- Database corruption recovery
- Concurrent access patterns
- Large dataset operations
- Invalid data input handling
- File system permission issues

### dhash Algorithm
- Extreme contrast images
- Minimal difference detection
- Scale invariance verification
- Noise resistance limits
- Bit precision boundaries

## Mock Strategy

The test suite uses strategic mocking for:
- **MSS screenshot capture** - Avoids requiring actual display
- **File system operations** - Uses temporary directories
- **Time-dependent operations** - Controlled timestamps
- **PIL Image operations** - Predictable image data

## Performance Considerations

Tests are designed to be:
- **Fast** - No real screenshot capture or heavy I/O
- **Reliable** - Deterministic outcomes with mocked dependencies
- **Isolated** - No side effects between test runs
- **Comprehensive** - High code coverage with meaningful assertions

## Extending Tests

When adding new functionality:

1. **Add unit tests** for the new component
2. **Update integration tests** for end-to-end workflows
3. **Add appropriate fixtures** to `conftest.py` if reusable
4. **Include edge cases** and error conditions
5. **Update this README** with new test categories

## Coverage Goals

- **Code Coverage**: ≥85%
- **Branch Coverage**: ≥80%
- **Function Coverage**: ≥90%

Current coverage focuses on:
- All public interfaces
- Error handling paths
- Edge cases and boundary conditions
- Integration points between components