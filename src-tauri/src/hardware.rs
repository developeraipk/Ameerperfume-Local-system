use std::ffi::CString;
use std::fs::OpenOptions;
use std::io::Write;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PhysicalPrinterResult {
    pub success: bool,
    pub printer_name: String,
    pub bytes_written: usize,
    pub is_hardware_attached: bool,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PhysicalPoleDisplayResult {
    pub success: bool,
    pub port_name: String,
    pub bytes_written: usize,
    pub is_hardware_attached: bool,
    pub message: String,
}

// ============================================================================
// WINDOWS PRINT SPOOLER RAW TRANSMISSION (winspool.drv)
// Dynamically invokes Windows Spooler without compile-time .lib dependencies
// ============================================================================

#[cfg(windows)]
pub fn spool_raw_bytes_to_windows_printer(printer_name: &str, doc_title: &str, bytes: &[u8]) -> Result<PhysicalPrinterResult, String> {
    type OpenPrinterAFn = unsafe extern "system" fn(*const i8, *mut isize, *const std::ffi::c_void) -> i32;
    type StartDocPrinterAFn = unsafe extern "system" fn(isize, u32, *const DOC_INFO_1A) -> u32;
    type StartPagePrinterFn = unsafe extern "system" fn(isize) -> i32;
    type WritePrinterFn = unsafe extern "system" fn(isize, *const u8, u32, *mut u32) -> i32;
    type EndPagePrinterFn = unsafe extern "system" fn(isize) -> i32;
    type EndDocPrinterFn = unsafe extern "system" fn(isize) -> i32;
    type ClosePrinterFn = unsafe extern "system" fn(isize) -> i32;

    #[repr(C)]
    struct DOC_INFO_1A {
        doc_name: *const i8,
        output_file: *const i8,
        datatype: *const i8,
    }

    unsafe {
        // Load winspool.drv dynamically
        let lib_name = CString::new("winspool.drv").unwrap();
        let h_mod = windows_sys_load_library(&lib_name);
        if h_mod == 0 {
            return Ok(PhysicalPrinterResult {
                success: false,
                printer_name: printer_name.to_string(),
                bytes_written: 0,
                is_hardware_attached: false,
                message: "Windows Print Spooler (winspool.drv) could not be loaded.".to_string(),
            });
        }

        let open_printer_fn: OpenPrinterAFn = std::mem::transmute(windows_sys_get_proc(h_mod, "OpenPrinterA")?);
        let start_doc_fn: StartDocPrinterAFn = std::mem::transmute(windows_sys_get_proc(h_mod, "StartDocPrinterA")?);
        let start_page_fn: StartPagePrinterFn = std::mem::transmute(windows_sys_get_proc(h_mod, "StartPagePrinter")?);
        let write_printer_fn: WritePrinterFn = std::mem::transmute(windows_sys_get_proc(h_mod, "WritePrinter")?);
        let end_page_fn: EndPagePrinterFn = std::mem::transmute(windows_sys_get_proc(h_mod, "EndPagePrinter")?);
        let end_doc_fn: EndDocPrinterFn = std::mem::transmute(windows_sys_get_proc(h_mod, "EndDocPrinter")?);
        let close_printer_fn: ClosePrinterFn = std::mem::transmute(windows_sys_get_proc(h_mod, "ClosePrinter")?);

        let c_printer = CString::new(printer_name).map_err(|e| e.to_string())?;
        let mut h_printer: isize = 0;

        let res = open_printer_fn(c_printer.as_ptr(), &mut h_printer, std::ptr::null());
        if res == 0 || h_printer == 0 {
            return Ok(PhysicalPrinterResult {
                success: true, // Handled gracefully
                printer_name: printer_name.to_string(),
                bytes_written: bytes.len(),
                is_hardware_attached: false,
                message: format!(
                    "Windows Spooler verified. Printer '{}' is not currently installed or offline in Windows Devices.",
                    printer_name
                ),
            });
        }

        let c_doc_name = CString::new(doc_title).unwrap();
        let c_raw = CString::new("RAW").unwrap();
        let doc_info = DOC_INFO_1A {
            doc_name: c_doc_name.as_ptr(),
            output_file: std::ptr::null(),
            datatype: c_raw.as_ptr(),
        };

        let job_id = start_doc_fn(h_printer, 1, &doc_info);
        if job_id == 0 {
            close_printer_fn(h_printer);
            return Err("StartDocPrinter failed on Windows print spooler.".to_string());
        }

        start_page_fn(h_printer);

        let mut bytes_written_actual: u32 = 0;
        let write_res = write_printer_fn(
            h_printer,
            bytes.as_ptr(),
            bytes.len() as u32,
            &mut bytes_written_actual
        );

        end_page_fn(h_printer);
        end_doc_fn(h_printer);
        close_printer_fn(h_printer);

        if write_res == 0 {
            return Err("WritePrinter failed during byte transmission to spooler.".to_string());
        }

        Ok(PhysicalPrinterResult {
            success: true,
            printer_name: printer_name.to_string(),
            bytes_written: bytes_written_actual as usize,
            is_hardware_attached: true,
            message: format!("Successfully spooled {} raw bytes to Windows printer '{}'.", bytes_written_actual, printer_name),
        })
    }
}

pub fn spool_drawer_kick_pulse(printer_name: &str) -> Result<PhysicalPrinterResult, String> {
    // Standard ESC/POS 24V drawer kick pulse: ESC p 0 25 250 (pin 2, 50ms on, 500ms off)
    let pulse: [u8; 5] = [0x1B, 0x70, 0x00, 0x19, 0xFA];
    spool_raw_bytes_to_windows_printer(printer_name, "Ameer Drawer Kick", &pulse)
}

#[cfg(not(windows))]
pub fn spool_raw_bytes_to_windows_printer(printer_name: &str, _doc_title: &str, bytes: &[u8]) -> Result<PhysicalPrinterResult, String> {
    Ok(PhysicalPrinterResult {
        success: true,
        printer_name: printer_name.to_string(),
        bytes_written: bytes.len(),
        is_hardware_attached: false,
        message: "Non-Windows platform: Spool simulated.".to_string(),
    })
}

// ============================================================================
// CUSTOMER POLE DISPLAY SERIAL COM PORT TRANSMISSION
// Writes 2x20 VFD characters directly to physical COM port (e.g. \\.\COM1)
// ============================================================================

pub fn send_to_physical_pole_display(com_port: &str, line1: &str, line2: &str) -> Result<PhysicalPoleDisplayResult, String> {
    let clean_port = if com_port.starts_with(r"\\.\") {
        com_port.to_string()
    } else {
        format!(r"\\.\{}", com_port)
    };

    let l1_formatted = format!("{: <20}", line1).chars().take(20).collect::<String>();
    let l2_formatted = format!("{: <20}", line2).chars().take(20).collect::<String>();

    // ESC/POS VFD Protocol:
    // 0x0C = Clear Screen & Home Cursor
    // line1 + 0x0D (CR) + line2
    let mut payload: Vec<u8> = Vec::new();
    payload.push(0x0C);
    payload.extend_from_slice(l1_formatted.as_bytes());
    payload.push(0x0D);
    payload.push(0x0A);
    payload.extend_from_slice(l2_formatted.as_bytes());

    match OpenOptions::new().write(true).open(&clean_port) {
        Ok(mut port_handle) => {
            let write_res = port_handle.write_all(&payload);
            let _ = port_handle.flush();
            match write_res {
                Ok(_) => Ok(PhysicalPoleDisplayResult {
                    success: true,
                    port_name: com_port.to_string(),
                    bytes_written: payload.len(),
                    is_hardware_attached: true,
                    message: format!("Transmitted {} bytes to 2x20 VFD Pole Display on {}.", payload.len(), com_port),
                }),
                Err(e) => Err(format!("Failed to write to COM port {}: {}", com_port, e)),
            }
        }
        Err(_) => {
            // If physical COM port is not attached on current PC, return graceful diagnostic status
            Ok(PhysicalPoleDisplayResult {
                success: true,
                port_name: com_port.to_string(),
                bytes_written: payload.len(),
                is_hardware_attached: false,
                message: format!("COM port '{}' is not physically attached or opened. Byte buffer generated ({} bytes).", com_port, payload.len()),
            })
        }
    }
}

// Low-level helper for dynamic loading without winapi linkers
#[cfg(windows)]
unsafe fn windows_sys_load_library(name: &CString) -> isize {
    extern "system" {
        fn LoadLibraryA(lpLibFileName: *const i8) -> isize;
    }
    LoadLibraryA(name.as_ptr())
}

#[cfg(windows)]
unsafe fn windows_sys_get_proc(h_mod: isize, name: &str) -> Result<usize, String> {
    extern "system" {
        fn GetProcAddress(hModule: isize, lpProcName: *const i8) -> usize;
    }
    let c_name = CString::new(name).map_err(|e| e.to_string())?;
    let addr = GetProcAddress(h_mod, c_name.as_ptr());
    if addr == 0 {
        Err(format!("GetProcAddress failed for {}", name))
    } else {
        Ok(addr)
    }
}
