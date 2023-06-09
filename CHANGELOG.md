# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2023-06-17

### Added

- filter file uploads by `.mxl` extension

### Fixed

- serial output no longer sent if cursor has not moved or port isn't connected

## [0.2.0] - 2023-06-15

### Changed

- use a single color for onscreen keyboard simplicity

### Added

- support for sending notes over a serial port to light an LED strip

## [0.1.3] - 2023-04-11

### Changed

- play a different sound (harpsichord) on wrong notes
- use only a single cursor
- swap keyboard key colors to draw attention to keys which require action
  - required is now green
  - pressed is now grey
- remove boomwhacker colors toggle

## [0.1.2] - 2023-03-31

### Added

- toggle playback with space bar
- persist settings in browser storage

## [0.1.1] - 2023-03-31

### Fixed

- practice and listen functionality restored

## [0.1.0] - 2023-03-29

### Added

- initial work from forked project

### Changed

- overhaul of UI layout
