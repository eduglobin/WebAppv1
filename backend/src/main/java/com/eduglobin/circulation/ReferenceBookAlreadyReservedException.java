package com.eduglobin.circulation;

import com.eduglobin.common.EduGlobinException;

public class ReferenceBookAlreadyReservedException extends EduGlobinException {
    public ReferenceBookAlreadyReservedException() {
        super("This reference book is already reserved during the requested time window.");
    }
}
