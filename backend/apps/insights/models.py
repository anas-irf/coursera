"""The insights slice owns no tables: its dashboards are read models over the other slices.

The analytics tables (course, student, lecture and platform analytics) were never written by
anything and were dropped by migration ``0002``.
"""
